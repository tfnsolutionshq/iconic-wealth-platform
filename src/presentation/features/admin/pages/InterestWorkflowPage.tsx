import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Lock, Search } from "lucide-react";
import type { AuditCategory, InterestCalcRow, InterestWorkflow } from "@/domain/entities";
import { formatNaira } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { Banner, Button, Card, Checkbox, DataTable, Kpi, Modal, OpenDecisionTag, Pill, SelectField, TextField } from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";
import { INTEREST_STAGES } from "./InterestPage";
import { downloadCsv } from "../../../utils/csv";

const STATUS_TONE = { "Not started": "mute", Draft: "info", "Pending approval": "pending", Returned: "fail", Approved: "ok", "Paid out": "ok" } as const;
const LOCKED = ["Pending approval", "Approved", "Paid out"];

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
  const [rounding, setRounding] = useState("Nearest naira");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [channels, setChannels] = useState({ InApp: true, Email: true, SMS: true, WhatsApp: true });
  const [q, setQ] = useState("");

  const reload = async (keepStage?: number) => {
    const d = await repos.admin.getInterest(y);
    setW(d.workflow);
    setPreview(d.preview);
    setStage(keepStage ?? d.workflow.stage);
    setPeriod({ start: d.workflow.start, end: d.workflow.end, close: d.workflow.close });
    setRate(d.workflow.rate != null ? String(d.workflow.rate) : "");
    setRounding(d.workflow.rounding);
    setNote(d.workflow.note);
  };
  useEffect(() => {
    reload().catch(() => setMissing(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, y]);

  const audit = (action: string, entity: string, change: string, category: AuditCategory = "Financial"): Promise<void> => {
    if (!admin) return Promise.resolve();
    return repos.admin.logAudit({ at: clock.now().toISOString(), actor: admin.name, role: roleLabel(admin.role), action, entity, change, category }).then(() => {});
  };

  const run = async (fn: () => Promise<unknown>, ok: () => void, done: string, after?: () => void) => {
    setBusy(true);
    try {
      await fn();
      await reload(after ? undefined : stage);
      after?.();
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

  if (missing) {
    return (<><AdminPageHeader title="Not found" back={paths.admin.interest} /><p className="p-8 text-mute">No interest configuration for this year.</p></>);
  }
  if (!w) return (<><AdminPageHeader title="Interest" back={paths.admin.interest} /><p className="p-8 text-mute">Loading…</p></>);

  /* ---------- closed years: read-only ---------- */
  if (w.closed) {
    return (
      <>
        <AdminPageHeader title={`Interest · savings year ${y}`} sub="Closed period · read-only" back={paths.admin.interest} />
        <div className="flex flex-col gap-5 px-8 py-6">
          <Banner tone="neutral" icon={<Lock size={20} />}>This period is closed. Figures below are the approved record.</Banner>
          <div className="grid gap-3.5 md:grid-cols-4">
            <Kpi label="Rate applied" value={`${w.rate}%`} />
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
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold">Members</h2>
              <label className="ml-auto flex h-10 w-64 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute">
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
  const isMaker = w.maker === adminName;
  const canCheck = isSuper && !isMaker;

  const savePeriod = () => run(() => repos.admin.saveInterestPeriod(y, period), () => setStage(2), "Period saved.");
  const saveRules = () => {
    const r = Number(rate);
    if (!Number.isFinite(r) || r < 0.1 || r > 30) { toast("Rate must be between 0.1% and 30%."); return; }
    run(() => repos.admin.saveInterestRules(y, { rate: r, rounding }), () => setStage(3), "Rules saved.");
  };
  const calculate = () => run(() => repos.admin.runInterestCalculation(y), () => setStage(4), "Calculation complete.");
  const submit = () => run(() => repos.admin.submitInterest(y, note, adminName).then((wf) => audit("Submitted interest for approval", `Interest ${y}`, `${wf.eligible} eligible · ${wf.rate}%`, "Financial")), () => {}, "Sent for approval.");
  const approve = () => run(() => repos.admin.decideInterest(y, "Approved", { by: adminName }).then((wf) => audit("Approved interest configuration", `Interest ${y}`, `${wf.rate}% · ${formatNaira(wf.interestKobo)}`, "Financial")), () => setApproveOpen(false), "Configuration approved.");
  const returnToMaker = () => run(() => repos.admin.decideInterest(y, "Returned", { by: adminName, reason }).then(() => audit("Returned interest to maker", `Interest ${y}`, reason, "Financial")), () => { setReturnOpen(false); setReason(""); }, "Returned to maker.");
  const createBatch = () => run(() => repos.admin.createPayoutBatch(y, adminName).then((b) => audit("Created payout batch", b.id, `${b.count} members`, "Financial")), () => {}, "Batch created.");
  const notify = () => run(() => repos.admin.notifyInterest(y, adminName).then(() => audit("Notified members of interest", `Interest ${y}`, `${w.eligible} eligible`, "Financial")), () => {}, `Sent to ${w.eligible.toLocaleString()} members.`);

  return (
    <>
      <AdminPageHeader
        title={`Interest · savings year ${y}`}
        sub={<span className="flex items-center gap-2"><Pill tone={STATUS_TONE[w.status]}>{w.status}</Pill> Maker: Administrator · Checker: Super Admin</span>}
        back={paths.admin.interest}
      />
      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="grid gap-2 md:grid-cols-8">
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
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Interest rate (%)" inputMode="decimal" placeholder="e.g. 10" hint="2025 · 10%, 2024 · 9%" value={rate} disabled={locked} onChange={(e) => setRate(e.target.value)} />
              <SelectField label="Rounding" options={["Nearest naira", "Nearest kobo"]} value={rounding} disabled={locked} onChange={(e) => setRounding(e.target.value)} />
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
                <p className="text-sm font-semibold text-mute">Ready to calculate{w.rate ? ` at ${w.rate}%` : ""}.</p>
                {!locked && <Button size="md" disabled={busy || w.rate == null} onClick={calculate}>{busy ? "Calculating…" : "Run calculation"}</Button>}
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
                    <div className="ml-auto flex gap-2">
                      {!locked && <Button variant="outline" size="sm" onClick={calculate} disabled={busy}>Recalculate</Button>}
                      <Button variant="outline" size="sm" onClick={() => { downloadCsv(`iwh-interest-${y}-preview.csv`, ["Member", "Contributions", "Share %", "Interest", "Status"], preview.map((p) => [p.memberName, formatNaira(p.contributionsKobo), `${p.sharePct}%`, formatNaira(p.interestKobo), p.eligible ? "Eligible" : "Forfeited"])); toast("Preview exported."); }}>Export</Button>
                      <label className="flex h-9 w-56 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute">
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
                      { header: "Share", align: "right", render: (r) => `${r.sharePct}%` },
                      { header: "Interest", align: "right", render: (r) => <b>{formatNaira(r.interestKobo)}</b> },
                      { header: "Status", render: (r) => (r.eligible ? <Pill tone="ok">Eligible</Pill> : <Pill tone="fail">{r.reason ?? "Forfeited"}</Pill>) },
                    ]}
                  />
                  {!locked && <div><Button size="md" onClick={() => setStage(4)}>Save and continue</Button></div>}
                </Card>
              </>
            )}
          </div>
        )}

        {stage === 4 && (
          <Card className="flex max-w-2xl flex-col gap-4">
            <h2 className="text-base font-extrabold">Review and submit</h2>
            {[["Period", `${w.start} – ${w.end}`], ["Rate", w.rate != null ? `${w.rate}%` : "—"],
              ["Eligible", w.eligible.toLocaleString()], ["Forfeited", String(w.forfeited)], ["Total interest", formatNaira(w.interestKobo)]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
                <span className="font-semibold text-mute">{k}</span><b>{v}</b>
              </div>
            ))}
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
            ) : isMaker ? (
              <Banner tone="neutral">Waiting for a Super Admin to approve. You can’t approve your own work — switch role from the header in demo mode.</Banner>
            ) : canCheck ? (
              <>
                <p className="text-sm font-semibold">Rate {w.rate}% · total interest {formatNaira(w.interestKobo)} · {w.eligible.toLocaleString()} eligible.</p>
                {w.note && <p className="text-sm text-mute">Maker’s note: {w.note}</p>}
                <div className="flex flex-wrap gap-2.5">
                  <Button size="md" onClick={() => setApproveOpen(true)}>Approve configuration</Button>
                  <Button size="md" variant="outline" onClick={() => setReturnOpen(true)}>Return to maker</Button>
                  <Button size="md" variant="outline" onClick={() => setStage(3)}>Review calculation</Button>
                </div>
              </>
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
            <Card tone="soft"><p className="text-sm font-semibold leading-relaxed">Good news: your {y} interest of {w.rate}% has been approved. Eligible savers will receive interest with the December payout.</p></Card>
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
        <p className="leading-relaxed text-[#474252]">This locks the rate at {w.rate}% for {w.eligible.toLocaleString()} eligible members ({formatNaira(w.interestKobo)} total interest).</p>
      </Modal>

      <Modal open={returnOpen} title="Return to maker" onClose={() => setReturnOpen(false)}
        footer={<><Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button><Button variant="danger" disabled={!reason.trim() || busy} onClick={returnToMaker}>Return to maker</Button></>}>
        <label className="flex flex-col gap-1.5 text-sm font-bold">Reason (sent to the maker)
          <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required"
            className="w-full rounded-input border-[1.5px] border-line bg-white p-3.5 text-[15px] font-semibold outline-none focus:border-brand" />
        </label>
      </Modal>
    </>
  );
}
