import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ChevronDown, Lock, Search, X } from "lucide-react";
import type { AuditCategory, Eligibility, InterestBand, InterestCalcRow, InterestRateMode, InterestScope, InterestWorkflow, MemberSummary } from "@/domain/entities";
import { formatNaira, parseNairaInput } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { Banner, Button, Card, Checkbox, Chips, cn, DataTable, Kpi, Modal, OpenDecisionTag, Pill, SelectField, TextField } from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";
import { INTEREST_STAGES } from "./InterestPage";
import { downloadCsv } from "../../../utils/csv";

const STATUS_TONE = { "Not started": "mute", Draft: "info", "Pending approval": "pending", Returned: "fail", Approved: "ok", "Paid out": "ok" } as const;
const LOCKED = ["Pending approval", "Approved", "Paid out"];
const MIN_BAND_KOBO = parseNairaInput("10000");

type BandDraft = { min: string; max: string; rate: string };
type PickerEligibility = "All" | Eligibility;
const bandToDraft = (b: InterestBand): BandDraft => ({
  min: String(Math.round(b.minKobo / 100)),
  max: b.maxKobo == null ? "" : String(Math.round(b.maxKobo / 100)),
  rate: String(b.rate),
});
const rateLabel = (w: InterestWorkflow) =>
  w.rateMode === "Contribution ranges"
    ? `${(w.bands ?? []).length} contribution band${(w.bands ?? []).length === 1 ? "" : "s"}`
    : w.rate != null
      ? `${w.rate}%`
      : "Not set";

function BandSummary({ bands }: { bands: InterestBand[] }) {
  if (!bands.length) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border-[1.5px] border-line bg-soft p-3 text-sm">
      {bands.map((b, i) => (
        <div key={i} className="flex justify-between gap-3">
          <span className="font-semibold text-mute">
            {formatNaira(b.minKobo)} – {b.maxKobo == null ? "No limit" : formatNaira(b.maxKobo)}
          </span>
          <b>{b.rate}%</b>
        </div>
      ))}
    </div>
  );
}

/** ADM-16, ADM-17: 8-stage maker-checker interest workflow. Past years are read-only. */
export function InterestWorkflowPage() {
  const { year } = useParams();
  const y = Number(year);
  const { repos, clock } = useServices();
  const toast = useToast();
  const { session } = useAuth();
  const admin = session?.kind === "admin" ? session.admin : null;
  const adminName = admin?.name ?? "You";
  const isSuper = admin?.role === "SuperAdmin";
  const roleLabel = (r: string) => (r === "SuperAdmin" ? "Super Admin" : r);

  const [w, setW] = useState<InterestWorkflow | null>(null);
  const [preview, setPreview] = useState<InterestCalcRow[]>([]);
  const [stage, setStage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [period, setPeriod] = useState({ start: "", end: "", close: "" });
  const [rate, setRate] = useState("");
  const [rateMode, setRateMode] = useState<InterestRateMode>("Fixed rate");
  const [bands, setBands] = useState<BandDraft[]>([{ min: "10000", max: "", rate: "" }]);
  const [rounding, setRounding] = useState("Nearest naira");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [channels, setChannels] = useState({ InApp: true, Email: true, WhatsApp: true });
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<InterestScope>("All members");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerEligibility, setPickerEligibility] = useState<PickerEligibility>("All");
  const [pickerMembers, setPickerMembers] = useState<MemberSummary[]>([]);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [membersBusy, setMembersBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const reload = async (keepStage?: number) => {
    const d = await repos.admin.getInterest(y);
    setW(d.workflow);
    setPreview(d.preview);
    setStage(keepStage ?? d.workflow.stage);
    setPeriod({ start: d.workflow.start, end: d.workflow.end, close: d.workflow.close });
    setRate(d.workflow.rate != null ? String(d.workflow.rate) : "");
    setRateMode(d.workflow.rateMode ?? "Fixed rate");
    setBands(d.workflow.bands?.length ? d.workflow.bands.map(bandToDraft) : [{ min: "10000", max: "", rate: "" }]);
    setRounding(d.workflow.rounding);
    setNote(d.workflow.note);
    setScope(d.workflow.scope);
    setSelectedIds(d.workflow.selectedMemberIds);
  };
  useEffect(() => {
    reload().catch(() => setMissing(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, y]);

  const audit = (action: string, entity: string, change: string, category: AuditCategory = "Financial"): Promise<void> => {
    if (!admin) return Promise.resolve();
    return repos.admin.logAudit({ at: clock.now().toISOString(), actor: admin.name, role: roleLabel(admin.role), action, entity, change, category }).then(() => {});
  };

  /** Runs an action, then adopts the workflow's own stage so the wizard advances automatically (submit → approval → batch → notify → history). */
  const run = async (fn: () => Promise<unknown>, ok: () => void, done: string) => {
    setBusy(true);
    try {
      await fn();
      await reload();
      toast(done);
      ok();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return preview.filter((p) => !s || `${p.memberName} ${p.memberId}`.toLowerCase().includes(s));
  }, [preview, q]);

  const pickerCounts = useMemo(() => ({
    All: pickerMembers.length,
    Eligible: pickerMembers.filter((m) => m.eligibility === "Eligible").length,
    Forfeited: pickerMembers.filter((m) => m.eligibility === "Forfeited").length,
  }), [pickerMembers]);

  const pickerFiltered = useMemo(() => {
    const s = pickerQuery.trim().toLowerCase();
    return pickerMembers
      .filter((m) => pickerEligibility === "All" || m.eligibility === pickerEligibility)
      .filter((m) => !s || `${m.name} ${m.id}`.toLowerCase().includes(s));
  }, [pickerMembers, pickerQuery, pickerEligibility]);

  const selectedMembers = useMemo(
    () => (scope === "All members" ? members : members.filter((m) => selectedIds.includes(m.id)))
      .filter((m) => !(w?.excludedMemberIds ?? []).includes(m.id)),
    [scope, members, selectedIds, w?.excludedMemberIds],
  );
  const selectedCount = selectedMembers.length;

  useEffect(() => {
    if (stage !== 2 || members.length > 0) return;
    let live = true;
    setMembersBusy(true);
    repos.admin
      .listMembers({ tab: "All", search: "" })
      .then((list) => { if (live) setMembers(list); })
      .catch(() => {})
      .finally(() => { if (live) setMembersBusy(false); });
    return () => { live = false; };
  }, [stage, members.length, repos.admin]);

  const openPicker = async () => {
    setPickerOpen(true);
    setPickerQuery("");
    setPickerEligibility("All");
    setDraftIds(selectedIds);
    if (pickerMembers.length === 0) {
      setPickerBusy(true);
      try { setPickerMembers(await repos.admin.listMembers({ tab: "All", search: "" })); }
      catch (e) { toast((e as Error).message); }
      finally { setPickerBusy(false); }
    }
  };

  if (missing) {
    return (<><AdminPageHeader title="Not found" back={paths.admin.interest} /><p className="p-8 text-mute">No interest configuration for this year.</p></>);
  }
  if (!w) return (<><AdminPageHeader title="Interest" back={paths.admin.interest} /><p className="p-8 text-mute">Loading…</p></>);

  /* ---------- closed years: read-only ---------- */
  if (w.closed) {
    return (
      <>
        <AdminPageHeader title={`Interest · savings year ${y}`} sub="Closed period · read-only" back={paths.admin.interest} />
        <div className="flex flex-col gap-5 px-4 py-5 sm:px-8 sm:py-6">
          <Banner tone="neutral" icon={<Lock size={20} />}>This period is closed. Figures below are the approved record.</Banner>
          <div className="grid gap-3.5 md:grid-cols-4">
            <Kpi label="Rate applied" value={rateLabel(w)} />
            <Kpi label="Eligible members" value={w.eligible.toLocaleString()} note={`${w.forfeited} forfeited`} />
            <Kpi label="Eligible contributions" value={formatNaira(w.contributionsKobo)} />
            <Kpi label="Total interest" value={formatNaira(w.interestKobo)} note="Paid out" tone="good" />
          </div>
          <Card className="flex flex-col gap-1">
            <h2 className="text-base font-extrabold">Approval</h2>
            <div className="flex justify-between gap-3 py-2 text-sm"><span className="font-semibold text-mute">Prepared by</span><b>{w.maker}</b></div>
            <div className="flex justify-between gap-3 py-2 text-sm"><span className="font-semibold text-mute">Approved by</span><b>{w.checker} · {w.approvedAt}</b></div>
            <div className="flex justify-between gap-3 py-2 text-sm"><span className="font-semibold text-mute">Payout batch</span>
              {w.batchId ? <Link to={paths.admin.payoutBatch(w.batchId)} className="font-bold text-brand underline underline-offset-2">{w.batchId}</Link> : <b>—</b>}
            </div>
          </Card>
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold">Members</h2>
              <label className="flex h-10 w-full items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute sm:ml-auto sm:w-64">
                <Search size={16} />
                <input className="w-full bg-transparent text-sm font-semibold text-ink outline-none" placeholder="Search member" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
            </div>
            <DataTable<InterestCalcRow>
              rows={filtered}
              rowKey={(r) => r.memberId}
              columns={[
                { header: "Member", render: (r) => <b>{r.memberName}</b> },
                { header: "Savings", align: "right", render: (r) => formatNaira(r.contributionsKobo) },
                { header: "Rate", align: "right", render: (r) => (r.rate != null ? `${r.rate}%` : "—") },
                { header: "Interest", align: "right", render: (r) => <b>{formatNaira(r.interestKobo)}</b> },
                { header: "Total paid", align: "right", render: (r) => <b>{formatNaira(r.contributionsKobo + r.interestKobo)}</b> },
                { header: "Payout status", render: () => <Pill tone="ok">Paid</Pill> },
              ]}
            />
          </Card>
        </div>
      </>
    );
  }

  /* ---------- current year: wizard ---------- */
  const locked = LOCKED.includes(w.status);
  const hasRates = w.rateMode === "Contribution ranges" ? (w.bands ?? []).length > 0 : w.rate != null;
  const isMaker = w.maker === adminName;
  /** ADM-16/17: a Super Admin checks — including their own maker request; only non-Super Admins are blocked from approving. */
  const canCheck = isSuper;

  const savePeriod = () => run(() => repos.admin.saveInterestPeriod(y, period), () => setStage(2), "Period saved.");
  const saveRules = () => {
    if (scope === "Selected members" && selectedIds.length === 0) { toast("Select at least one member, or apply interest to all members."); return; }
    let fixedRate: number | null = null;
    let parsedBands: InterestBand[] = [];
    if (rateMode === "Fixed rate") {
      fixedRate = Number(rate);
      if (!Number.isFinite(fixedRate) || fixedRate < 0.1 || fixedRate > 30) { toast("Rate must be between 0.1% and 30%."); return; }
    } else {
      parsedBands = bands
        .map((b) => ({
          minKobo: parseNairaInput(b.min),
          maxKobo: b.max.trim() === "" ? null : parseNairaInput(b.max),
          rate: Number(b.rate),
        }))
        .sort((a, b) => a.minKobo - b.minKobo);
      if (!parsedBands.length) { toast("Add at least one contribution range."); return; }
      if (parsedBands.some((b) => b.minKobo <= 0)) { toast("Enter a starting amount for every range."); return; }
      if (parsedBands[0].minKobo !== MIN_BAND_KOBO) { toast("The lowest contribution range must start at ₦10,000."); return; }
      for (let i = 0; i < parsedBands.length; i++) {
        const b = parsedBands[i];
        if (!Number.isFinite(b.rate) || b.rate < 0.1 || b.rate > 30) { toast("Each range rate must be between 0.1% and 30%."); return; }
        if (b.maxKobo != null && b.maxKobo <= b.minKobo) { toast("Each range must end above where it starts."); return; }
        const prev = parsedBands[i - 1];
        if (prev) {
          if (prev.maxKobo == null) { toast("Only the last range can have no upper limit."); return; }
          if (b.minKobo <= prev.maxKobo) { toast("Contribution ranges must not overlap."); return; }
        }
      }
    }
    run(
      () => repos.admin.saveInterestRules(y, {
        rateMode,
        rate: fixedRate,
        bands: parsedBands,
        rounding,
        scope,
        selectedMemberIds: scope === "Selected members" ? selectedIds : [],
      }),
      () => setStage(3),
      "Rules saved.",
    );
  };
  const calculate = () => run(() => repos.admin.runInterestCalculation(y), () => setStage(4), "Calculation complete.");
  const removeFromPayout = (row: InterestCalcRow) => run(
    () => repos.admin.setInterestExclusions(y, [...(w.excludedMemberIds ?? []), row.memberId])
      .then((wf) => audit("Removed member from payout", row.memberId, `${row.memberName} · ${wf.eligible} eligible`, "Financial")),
    () => {},
    `${row.memberName} removed from payout.`,
  );
  const removeMemberFromPreview = (m: MemberSummary) => run(
    () => repos.admin.setInterestExclusions(y, [...(w.excludedMemberIds ?? []), m.id])
      .then((wf) => audit("Removed member from payout", m.id, `${m.name} · ${wf.eligible} eligible`, "Financial")),
    () => {},
    `${m.name} removed from payout.`,
  );
  const restorePayoutMembers = () => run(
    () => repos.admin.setInterestExclusions(y, [])
      .then((wf) => audit("Restored payout members", `Interest ${y}`, `${(w.excludedMemberIds ?? []).length} restored · ${wf.eligible} eligible`, "Financial")),
    () => {},
    "Removed members restored.",
  );
  const submit = () => run(() => repos.admin.submitInterest(y, note, adminName).then((wf) => audit("Submitted interest for approval", `Interest ${y}`, `${wf.eligible} eligible · ${rateLabel(wf)}`, "Financial")), () => {}, "Sent for approval.");
  const approve = () => run(() => repos.admin.decideInterest(y, "Approved", { by: adminName, role: admin?.role }).then((wf) => audit("Approved interest configuration", `Interest ${y}`, `${rateLabel(wf)} · ${formatNaira(wf.interestKobo)}`, "Financial")), () => setApproveOpen(false), "Configuration approved.");
  const returnToMaker = () => run(() => repos.admin.decideInterest(y, "Returned", { by: adminName, role: admin?.role, reason }).then(() => audit("Returned interest to maker", `Interest ${y}`, reason, "Financial")), () => { setReturnOpen(false); setReason(""); }, "Returned to maker.");
  const createBatch = () => run(() => repos.admin.createPayoutBatch(y, adminName).then((b) => audit("Created payout batch", b.id, `${b.count} members`, "Financial")), () => {}, "Batch created.");
  const notify = () => run(() => repos.admin.notifyInterest(y, adminName).then(() => audit("Notified members of interest", `Interest ${y}`, `${w.eligible} eligible`, "Financial")), () => {}, `Sent to ${w.eligible.toLocaleString()} members.`);

  return (
    <>
      <AdminPageHeader
        title={`Interest · savings year ${y}`}
        sub={<span className="flex items-center gap-2"><Pill tone={STATUS_TONE[w.status]}>{w.status}</Pill> Maker: Administrator · Checker: Super Admin</span>}
        back={paths.admin.interest}
      />
      <div className="flex flex-col gap-5 px-4 py-5 sm:px-8 sm:py-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-8">
          {INTEREST_STAGES.map((s, i) => {
            const n = i + 1;
            const openable = n <= w.done + 1;
            return (
              <button
                key={s}
                disabled={!openable}
                title={openable ? s : "Finish the earlier stages first"}
                onClick={() => setStage(n)}
                className={`flex flex-col items-start gap-1.5 rounded-2xl border-[1.5px] p-2.5 text-left text-xs font-bold transition ${n === stage ? "border-brand bg-[#faf7fe] text-ink" : "border-line bg-white text-mute"} ${!openable ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <span className={`flex size-6 items-center justify-center rounded-full text-xs font-extrabold ${n <= w.done ? "bg-brand text-white" : n === stage ? "bg-gold text-[#2a1a00]" : "bg-soft text-mute"}`}>
                  {n <= w.done ? <Check size={12} /> : n}
                </span>
                {s}
              </button>
            );
          })}
        </div>

        {w.status === "Returned" && (
          <Banner tone="fail">Returned by the checker: {w.rejectReason}</Banner>
        )}

        {stage === 1 && (
          <Card className="flex max-w-2xl flex-col gap-4">
            <h2 className="text-base font-extrabold">Period setup</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Savings start" type="date" value={period.start} disabled={locked} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
              <TextField label="Savings end" type="date" value={period.end} disabled={locked} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
              <TextField label="Contributions close" type="date" value={period.close} disabled={locked} onChange={(e) => setPeriod({ ...period, close: e.target.value })} />
            </div>
            {!locked && <div><Button size="md" disabled={busy} onClick={savePeriod}>Save and continue</Button></div>}
          </Card>
        )}

        {stage === 2 && (
          <Card className="flex max-w-2xl flex-col gap-4">
            <h2 className="text-base font-extrabold">Rule configuration</h2>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">Interest rate structure</span>
              <Chips<InterestRateMode>
                value={rateMode}
                options={[
                  { value: "Fixed rate", label: "Fixed rate for all members" },
                  { value: "Contribution ranges", label: "Rates by contribution range" },
                ]}
                onChange={(v) => { if (!locked) setRateMode(v); }}
              />
              <p className="text-sm font-semibold leading-relaxed text-mute">
                {rateMode === "Fixed rate"
                  ? "One rate applies to every eligible member, whatever they saved."
                  : "Choose a rate for each band of total contributions. A member gets the rate for the band their savings fall into."}
              </p>
            </div>
            {rateMode === "Fixed rate" ? (
              <TextField label="Interest rate (%)" inputMode="decimal" placeholder="e.g. 10" hint="2025 · 10%, 2024 · 9%" value={rate} disabled={locked} onChange={(e) => setRate(e.target.value)} />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold">Contribution ranges</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={locked}
                    onClick={() => setBands((prev) => [...prev, { min: "", max: "", rate: "" }])}
                  >
                    Add range
                  </Button>
                </div>
                {bands.map((b, i) => (
                  <div
                    key={i}
                    className="grid gap-3 rounded-2xl border-[1.5px] border-line bg-soft p-3 sm:grid-cols-[1fr_1fr_0.85fr_auto] sm:items-end"
                  >
                    <TextField
                      label="From (₦)"
                      inputMode="numeric"
                      value={i === 0 ? "10,000" : b.min}
                      hint={i === 0 ? "Lowest amount" : undefined}
                      disabled={locked || i === 0}
                      onChange={(e) => setBands((prev) => prev.map((x, k) => k === i ? { ...x, min: e.target.value.replace(/\D/g, "") } : x))}
                    />
                    <TextField
                      label="To (₦)"
                      inputMode="numeric"
                      placeholder={i === bands.length - 1 ? "No limit" : "e.g. 100,000"}
                      value={b.max}
                      disabled={locked}
                      onChange={(e) => setBands((prev) => prev.map((x, k) => k === i ? { ...x, max: e.target.value.replace(/\D/g, "") } : x))}
                    />
                    <TextField
                      label="Rate (%)"
                      inputMode="decimal"
                      placeholder="e.g. 10"
                      value={b.rate}
                      disabled={locked}
                      onChange={(e) => setBands((prev) => prev.map((x, k) => k === i ? { ...x, rate: e.target.value } : x))}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={locked || bands.length === 1}
                      onClick={() => setBands((prev) => prev.filter((_, k) => k !== i).map((x, k) => k === 0 ? { ...x, min: "10000" } : x))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <p className="text-[13px] font-semibold leading-relaxed text-mute">
                  The first range always starts at ₦10,000. Leave the last “To” blank for no upper limit.
                </p>
              </div>
            )}
            <SelectField label="Rounding" options={["Nearest naira", "Nearest kobo"]} value={rounding} disabled={locked} onChange={(e) => setRounding(e.target.value)} />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">Apply interest to</span>
              <Chips<InterestScope>
                value={scope}
                options={[
                  { value: "All members", label: "All members" },
                  { value: "Selected members", label: "Select members manually" },
                ]}
                onChange={(v) => { if (!locked) setScope(v); }}
              />
              <p className="text-sm font-semibold leading-relaxed text-mute">
                {scope === "All members"
                  ? "Interest is calculated for every eligible member in this savings year."
                  : "Interest is calculated only for the members you pick. Everyone else is marked as not selected."}
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-line bg-soft px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold">
                  {scope === "All members" && membersBusy
                    ? "Loading members…"
                    : selectedCount === 0
                      ? "No members selected yet."
                      : `${selectedCount.toLocaleString()} member${selectedCount === 1 ? "" : "s"} selected.`}
                </span>
                {scope === "Selected members" && (
                  <Button variant="outline" size="sm" disabled={locked} onClick={openPicker}>{selectedIds.length === 0 ? "Choose members" : "Edit selection"}</Button>
                )}
                <button
                  onClick={() => setPreviewOpen((v) => !v)}
                  aria-expanded={previewOpen}
                  className="ml-auto inline-flex items-center gap-1 text-sm font-bold text-brand"
                >
                  {previewOpen ? "Hide preview" : "Preview"}
                  <ChevronDown size={16} className={cn("transition", previewOpen && "rotate-180")} />
                </button>
              </div>
              {previewOpen && (
                <div className="overflow-hidden rounded-xl border border-line bg-white">
                  {membersBusy ? (
                    <p className="px-3.5 py-3 text-sm font-semibold text-mute">Loading members…</p>
                  ) : selectedMembers.length === 0 ? (
                    <p className="px-3.5 py-3 text-sm font-semibold text-mute">
                      {scope === "Selected members" ? "No members selected yet." : "No members available."}
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {selectedMembers.map((m) => (
                        <div key={m.id} className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 text-sm last:border-b-0">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f1dfb9] text-[11px] font-extrabold text-[#6e4a0c]">
                            {m.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <b className="truncate text-[13px]">{m.name}</b>
                            <span className="text-[11px] font-semibold text-mute">{m.id}</span>
                          </span>
                          <Pill tone={m.eligibility === "Eligible" ? "ok" : "fail"}>{m.eligibility}</Pill>
                          {m.eligibility === "Eligible" && (
                            <button
                              type="button"
                              title="Remove from payout"
                              aria-label={`Remove ${m.name} from payout`}
                              disabled={busy || locked}
                              onClick={() => removeMemberFromPreview(m)}
                              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-mute transition hover:bg-fail-tint hover:text-fail focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {(w.excludedMemberIds ?? []).length > 0 && (
                    <div className="border-t border-line bg-soft px-3.5 py-2">
                      <button
                        type="button"
                        disabled={busy || locked}
                        onClick={restorePayoutMembers}
                        className="text-sm font-bold text-brand underline underline-offset-2 disabled:opacity-50"
                      >
                        Restore removed members ({(w.excludedMemberIds ?? []).length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <TextField label="Basis" value="Proportional to savings" readOnly />
            <p className="text-sm font-semibold leading-relaxed text-mute">A month that closes with nothing saved forfeits interest unless a Super Admin approves an exception.</p>
            <div className="flex flex-wrap gap-2">
              <OpenDecisionTag code="OD-11">Interest eligibility</OpenDecisionTag>
              <OpenDecisionTag code="OD-14">Interest calculation</OpenDecisionTag>
            </div>
            {!locked && <div><Button size="md" disabled={busy} onClick={saveRules}>Save and continue</Button></div>}
          </Card>
        )}

        {stage === 3 && (
          <div className="flex flex-col gap-4">
            {!w.calc ? (
              <Card className="flex max-w-2xl flex-col items-start gap-3">
                <h2 className="text-base font-extrabold">Calculation</h2>
                <p className="text-sm font-semibold text-mute">Ready to calculate{w.rateMode === "Fixed rate" && w.rate != null ? ` at ${w.rate}%` : " using contribution ranges"}.</p>
                {!locked && <Button size="md" disabled={busy || !hasRates} onClick={calculate}>{busy ? "Calculating…" : "Run calculation"}</Button>}
              </Card>
            ) : (
              <>
                <div className="grid gap-3.5 md:grid-cols-4">
                  <Kpi label="Eligible" value={preview.filter((p) => p.eligible).length.toLocaleString()} tone="good" />
                  <Kpi label="Forfeited" value={preview.filter((p) => !p.eligible).length} tone="bad" />
                  <Kpi label="Eligible contributions" value={formatNaira(w.contributionsKobo)} />
                  <Kpi label="Total interest" value={formatNaira(w.interestKobo)} />
                </div>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-extrabold">Calculation preview · sample of {preview.length}</h2>
                    <div className="ml-auto flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      {!locked && <Button variant="outline" size="sm" onClick={calculate} disabled={busy}>Recalculate</Button>}
                      {(w.excludedMemberIds ?? []).length > 0 && (
                        <Button variant="outline" size="sm" onClick={restorePayoutMembers} disabled={busy || locked}>
                          Restore removed ({w.excludedMemberIds.length})
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => { downloadCsv(`iwh-interest-${y}-preview.csv`, ["Member", "Contributions", "Rate", "Share %", "Interest", "Status"], preview.map((p) => [p.memberName, formatNaira(p.contributionsKobo), p.rate != null ? `${p.rate}%` : "—", `${p.sharePct}%`, formatNaira(p.interestKobo), p.eligible ? "Eligible" : "Forfeited"])); toast("Preview exported."); }}>Export</Button>
                      <label className="flex h-9 w-full sm:w-56 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute">
                        <Search size={16} />
                        <input className="w-full bg-transparent text-sm font-semibold text-ink outline-none" placeholder="Search member" value={q} onChange={(e) => setQ(e.target.value)} />
                      </label>
                    </div>
                  </div>
                  <DataTable<InterestCalcRow>
                    rows={filtered}
                    rowKey={(r) => r.memberId}
                    columns={[
                      { header: "Member", render: (r) => <b>{r.memberName}</b> },
                      { header: "Contributions", align: "right", render: (r) => formatNaira(r.contributionsKobo) },
                      { header: "Rate", align: "right", render: (r) => (r.rate != null ? `${r.rate}%` : "—") },
                      { header: "Share", align: "right", render: (r) => `${r.sharePct}%` },
                      { header: "Interest", align: "right", render: (r) => <b>{formatNaira(r.interestKobo)}</b> },
                      { header: "Status", render: (r) => (r.eligible ? <Pill tone="ok">Eligible</Pill> : <Pill tone="fail">{r.reason ?? "Forfeited"}</Pill>) },
                      {
                        header: "Action",
                        align: "right",
                        render: (r) => (r.eligible ? (
                          <button
                            type="button"
                            title="Remove from payout"
                            aria-label={`Remove ${r.memberName} from payout`}
                            disabled={busy || locked}
                            onClick={() => removeFromPayout(r)}
                            className="inline-flex size-8 items-center justify-center rounded-full text-mute transition hover:bg-fail-tint hover:text-fail focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
                          >
                            <X size={16} />
                          </button>
                        ) : null),
                      },
                    ]}
                  />
                  {!locked && <p className="text-[13px] font-semibold text-mute">Use the remove icon to exclude an eligible member from the payout batch.</p>}
                  {!locked && <div><Button size="md" onClick={() => setStage(4)}>Save and continue</Button></div>}
                </Card>
              </>
            )}
          </div>
        )}

        {stage === 4 && (
          <Card className="flex max-w-2xl flex-col gap-4">
            <h2 className="text-base font-extrabold">Review and submit</h2>
            {[["Period", `${w.start} – ${w.end}`], ["Rate", rateLabel(w)],
              ["Applies to", w.scope === "Selected members" ? `${w.selectedMemberIds.length} selected members` : "All members"],
              ["Eligible", w.eligible.toLocaleString()], ["Forfeited", String(w.forfeited)], ["Total interest", formatNaira(w.interestKobo)]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
                <span className="font-semibold text-mute">{k}</span><b>{v}</b>
              </div>
            ))}
            {w.rateMode === "Contribution ranges" && <BandSummary bands={w.bands ?? []} />}
            <label className="flex flex-col gap-1.5 text-sm font-bold">Note for the checker (optional)
              <textarea rows={3} value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} placeholder="Anything the checker should know"
                className="w-full rounded-input border-[1.5px] border-line bg-white p-3.5 text-[15px] font-semibold outline-none focus:border-brand" />
            </label>
            {!locked && <div><Button size="md" disabled={busy || !w.calc} onClick={submit}>Submit for approval</Button></div>}
          </Card>
        )}

        {stage === 5 && (
          <Card className="flex max-w-2xl flex-col items-start gap-3">
            <h2 className="text-base font-extrabold">Approval</h2>
            {w.status === "Approved" ? (
              <Banner tone="info" icon={<Check size={20} />}>Approved by {w.checker} on {w.approvedAt}.</Banner>
            ) : w.status !== "Pending approval" ? (
              <p className="text-sm font-semibold text-mute">Submit the configuration for approval first (stage 4).</p>
            ) : canCheck ? (
              <>
                <p className="text-sm font-semibold">Rate {rateLabel(w)} · total interest {formatNaira(w.interestKobo)} · {w.eligible.toLocaleString()} eligible.</p>
                {w.rateMode === "Contribution ranges" && <BandSummary bands={w.bands ?? []} />}
                {isMaker && <p className="text-sm text-mute">You prepared this request — as a Super Admin you can approve it yourself.</p>}
                {w.note && <p className="text-sm text-mute">Maker’s note: {w.note}</p>}
                <div className="flex flex-wrap gap-2.5">
                  <Button size="md" onClick={() => setApproveOpen(true)}>Approve configuration</Button>
                  <Button size="md" variant="outline" onClick={() => setReturnOpen(true)}>Return to maker</Button>
                  <Button size="md" variant="outline" onClick={() => setStage(3)}>Review calculation</Button>
                </div>
              </>
            ) : isMaker ? (
              <Banner tone="neutral">Waiting for a Super Admin to approve. Switch role from the header in demo mode.</Banner>
            ) : (
              <Banner tone="neutral">Only a Super Admin can approve. {isSuper ? "" : "Switch role from the header in demo mode."}</Banner>
            )}
          </Card>
        )}

        {stage === 6 && (
          <Card className="flex max-w-2xl flex-col items-start gap-3">
            <h2 className="text-base font-extrabold">Payout batch</h2>
            {!w.batchId ? (
              <>
                <p className="text-sm font-semibold leading-relaxed text-mute">Approval creates the December payout batch for the {w.eligible.toLocaleString()} eligible members.</p>
                {w.status === "Approved" && <Button size="md" disabled={busy} onClick={createBatch}>Create payout batch</Button>}
              </>
            ) : (
              <>
                <Banner tone="info" icon={<Check size={20} />}>Batch {w.batchId} is ready.</Banner>
                <Link to={paths.admin.payoutBatch(w.batchId)} className="font-bold text-brand underline underline-offset-2">Open payout batch ›</Link>
              </>
            )}
          </Card>
        )}

        {stage === 7 && (
          <Card className="flex max-w-2xl flex-col gap-3">
            <h2 className="text-base font-extrabold">Notify members</h2>
            <Card tone="soft"><p className="text-sm font-semibold leading-relaxed">Good news: your {y} interest has been approved. Eligible savers will receive interest with the December payout.</p></Card>
            <div className="grid gap-2 md:grid-cols-2">
              {(Object.keys(channels) as (keyof typeof channels)[]).map((c) => (
                <Checkbox key={c} checked={channels[c]} onChange={(v) => setChannels({ ...channels, [c]: v })}>{c === "InApp" ? "In-app" : c}</Checkbox>
              ))}
            </div>
            {w.notified ? (
              <Banner tone="info" icon={<Check size={20} />}>Members have been notified.</Banner>
            ) : (
              <div><Button size="md" disabled={busy} onClick={notify}>Notify members</Button></div>
            )}
          </Card>
        )}

        {stage === 8 && (
          <Card className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-base font-extrabold">History</h2>
            {w.history.length === 0 ? <p className="text-sm font-semibold text-mute">No events yet.</p> : w.history.map(([at, ev, who], i) => (
              <div key={i} className="flex items-center gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand-dark"><Check size={14} /></span>
                <span className="flex-1 font-semibold">{ev}</span>
                <span className="text-xs font-semibold text-mute">{who} · {at.slice(0, 16).replace("T", " ")}</span>
              </div>
            ))}
          </Card>
        )}
      </div>

      <Modal open={approveOpen} title="Approve configuration" onClose={() => setApproveOpen(false)}
        footer={<><Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button><Button disabled={busy} onClick={approve}>Approve</Button></>}>
        <div className="flex flex-col gap-3">
          <p className="leading-relaxed text-[#474252]">This locks the interest rules ({rateLabel(w)}) for {w.eligible.toLocaleString()} eligible members ({formatNaira(w.interestKobo)} total interest).</p>
          {w.rateMode === "Contribution ranges" && <BandSummary bands={w.bands ?? []} />}
        </div>
      </Modal>

      <Modal open={returnOpen} title="Return to maker" onClose={() => setReturnOpen(false)}
        footer={<><Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button><Button variant="danger" disabled={!reason.trim() || busy} onClick={returnToMaker}>Return to maker</Button></>}>
        <label className="flex flex-col gap-1.5 text-sm font-bold">Reason (sent to the maker)
          <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required"
            className="w-full rounded-input border-[1.5px] border-line bg-white p-3.5 text-[15px] font-semibold outline-none focus:border-brand" />
        </label>
      </Modal>

      <Modal open={pickerOpen} title="Choose members for interest" wide onClose={() => setPickerOpen(false)}
        footer={<>
          <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancel</Button>
          <Button disabled={draftIds.length === 0} onClick={() => { setSelectedIds(draftIds); setPickerOpen(false); }}>Apply selection ({draftIds.length})</Button>
        </>}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 w-full items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute sm:w-64">
              <Search size={16} />
              <input className="w-full bg-transparent text-sm font-semibold text-ink outline-none" placeholder="Search member" value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} />
            </label>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDraftIds((d) => Array.from(new Set([...d, ...pickerFiltered.map((m) => m.id)])))}>Select all shown</Button>
              <Button variant="outline" size="sm" onClick={() => setDraftIds([])}>Clear</Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">Interest eligibility</span>
            <Chips<PickerEligibility>
              value={pickerEligibility}
              options={[
                { value: "All", label: `All members (${pickerCounts.All})` },
                { value: "Eligible", label: `Eligible (${pickerCounts.Eligible})` },
                { value: "Forfeited", label: `Forfeited (${pickerCounts.Forfeited})` },
              ]}
              onChange={setPickerEligibility}
            />
          </div>
          <p className="text-[13px] font-semibold text-mute">
            Showing {pickerFiltered.length.toLocaleString()} of {pickerMembers.length.toLocaleString()} members · {draftIds.length.toLocaleString()} selected
          </p>
        </div>
        {pickerBusy ? (
          <p className="text-sm font-semibold text-mute">Loading members…</p>
        ) : pickerFiltered.length === 0 ? (
          <p className="text-sm font-semibold text-mute">No members match your search or eligibility filter.</p>
        ) : (
          <div className="flex flex-col">
            {pickerFiltered.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
                <input type="checkbox" className="size-5 shrink-0 accent-brand" checked={draftIds.includes(m.id)} onChange={(e) => setDraftIds((d) => (e.target.checked ? [...d, m.id] : d.filter((x) => x !== m.id)))} />
                <span className="flex-1"><b>{m.name}</b> <span className="text-mute">{m.id}</span></span>
                <Pill tone={m.eligibility === "Eligible" ? "ok" : "fail"}>{m.eligibility}</Pill>
              </label>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
