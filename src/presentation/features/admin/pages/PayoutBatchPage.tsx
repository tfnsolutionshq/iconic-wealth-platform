import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Download, LoaderCircle, Search } from "lucide-react";
import type { AuditCategory, PayoutBatch, PayoutRow } from "@/domain/entities";
import { formatNaira } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chips,
  DataTable,
  Kpi,
  Modal,
  Pill,
  Select,
  SelectField,
} from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";
import { downloadCsv } from "../../../utils/csv";

const ROW_TONE = {
  Paid: "ok",
  "Paid manually": "ok",
  Failed: "fail",
  Retrying: "info",
  Pending: "mute",
} as const;
type Tab = "All" | "Paid" | "Failed" | "Pending";
type Sort = "failed" | "name" | "amount";

/** ADM-19, ADM-20: payout batch detail with maker-checker approval and disbursement. */
export function PayoutBatchPage() {
  const { id } = useParams();
  const { repos, clock } = useServices();
  const toast = useToast();
  const { session } = useAuth();
  const admin = session?.kind === "admin" ? session.admin : null;
  const adminName = admin?.name ?? "You";
  const isSuper = admin?.role === "SuperAdmin";

  const [b, setB] = useState<PayoutBatch | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("All");
  const [sort, setSort] = useState<Sort>("failed");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [manual, setManual] = useState<PayoutRow | null>(null);
  const [method, setMethod] = useState("Bank transfer");
  const [proof, setProof] = useState("");
  const [note, setNote] = useState("");

  const reload = async () => {
    if (!id) return;
    setB(await repos.admin.getPayoutBatch(id));
  };
  useEffect(() => {
    reload().catch(() => setMissing(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, id]);

  const audit = (
    action: string,
    entity: string,
    change: string,
    category: AuditCategory = "Financial",
  ) =>
    admin
      ? repos.admin.logAudit({
          at: clock.now().toISOString(),
          actor: admin.name,
          role: admin.role === "SuperAdmin" ? "Super Admin" : "Administrator",
          action,
          entity,
          change,
          category,
        })
      : Promise.resolve();

  const act = async (
    fn: () => Promise<PayoutBatch>,
    done: string,
    after?: (nb: PayoutBatch) => void,
  ) => {
    setBusy(true);
    try {
      const nb = await fn();
      setB(nb);
      after?.(nb);
      toast(done);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rows = useMemo(() => {
    if (!b) return [];
    const q = search.trim().toLowerCase();
    const list = b.rows.filter(
      (r) =>
        (tab === "All" ||
          (tab === "Paid"
            ? r.status === "Paid" || r.status === "Paid manually"
            : tab === "Failed"
              ? r.status === "Failed" || r.status === "Retrying"
              : r.status === "Pending")) &&
        (!q || `${r.memberName} ${r.memberId}`.toLowerCase().includes(q)),
    );
    const failFirst = (r: PayoutRow) =>
      r.status === "Failed" || r.status === "Retrying" ? 0 : 1;
    return [...list].sort((a, z) =>
      sort === "name"
        ? a.memberName.localeCompare(z.memberName)
        : sort === "amount"
          ? z.totalKobo - a.totalKobo
          : failFirst(a) - failFirst(z) || z.totalKobo - a.totalKobo,
    );
  }, [b, tab, sort, search]);

  if (missing || (!b && missing)) {
    return (
      <>
        <AdminPageHeader title="Batch not found" back={paths.admin.payouts} />
        <p className="p-8 text-mute">No payout batch with this ID.</p>
      </>
    );
  }
  if (!b)
    return (
      <>
        <AdminPageHeader title="Payout batch" back={paths.admin.payouts} />
        <p className="p-8 text-mute">Loading…</p>
      </>
    );

  const failed = b.rows.filter((r) => r.status === "Failed").length;
  const isMaker = b.maker === adminName;
  /** ADM-19/20: a Super Admin checks — including their own batch; only non-Super Admins are blocked from approving. */
  const canCheck = isSuper;
  const count = (t: Tab) =>
    t === "All"
      ? b.rows.length
      : t === "Paid"
        ? b.rows.filter(
            (r) => r.status === "Paid" || r.status === "Paid manually",
          ).length
        : t === "Failed"
          ? b.rows.filter(
              (r) => r.status === "Failed" || r.status === "Retrying",
            ).length
          : b.rows.filter((r) => r.status === "Pending").length;

  const exportCsv = () => {
    downloadCsv(
      `${b.id}.csv`,
      [
        "Member ID",
        "Name",
        "Savings",
        "Interest",
        "Payout",
        "Account",
        "Status",
        "Reason",
      ],
      b.rows.map((r) => [
        r.memberId,
        r.memberName,
        formatNaira(r.savingsKobo),
        formatNaira(r.interestKobo),
        formatNaira(r.totalKobo),
        r.account,
        r.status,
        r.reason ?? "—",
      ]),
    );
    toast("Batch exported.");
  };

  return (
    <>
      <AdminPageHeader
        title={`Payout batch ${b.id}`}
        sub={`${b.month} ${b.year} disbursement · ${b.status}`}
        back={paths.admin.payouts}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="md"
              icon={<Download size={18} />}
              onClick={exportCsv}
            >
              Export
            </Button>
            {b.status === "Awaiting approval" && canCheck && (
              <>
                <Button
                  size="md"
                  variant="outline"
                  className="text-fail"
                  onClick={() => {
                    setRejectOpen(true);
                    setReason("");
                  }}
                >
                  Reject
                </Button>
                <Button
                  size="md"
                  onClick={() => {
                    setApproveOpen(true);
                    setReviewed(false);
                  }}
                >
                  Approve batch
                </Button>
              </>
            )}
            {b.status === "Returned to maker" && !isSuper && (
              <Button
                size="md"
                disabled={busy}
                onClick={() =>
                  act(
                    () =>
                      repos.admin.resubmitBatch(b.id, adminName).then((nb) => {
                        audit(
                          "Resubmitted payout batch",
                          b.id,
                          "Returned → Awaiting approval",
                        );
                        return nb;
                      }),
                    "Resubmitted for approval.",
                  )
                }
              >
                Resubmit for approval
              </Button>
            )}
            {b.status === "Approved" && (
              <Button
                size="md"
                disabled={busy}
                onClick={() =>
                  act(
                    () => repos.admin.startDisbursement(b.id, adminName),
                    "Disbursement finished.",
                  )
                }
              >
                Start disbursement
              </Button>
            )}
          </div>
        }
      />
      <div className="flex flex-col gap-5 px-4 py-5 sm:px-8 sm:py-6">
        {b.status === "Awaiting approval" && !canCheck && (
          <Banner tone="neutral">
            Prepared by {b.maker}.{" "}
            {isMaker
              ? "You prepared this batch — a Super Admin must approve it."
              : "Only a Super Admin can approve. Switch role from the header in demo mode."}
          </Banner>
        )}
        {b.status === "Awaiting approval" && canCheck && isMaker && (
          <Banner tone="info">
            You prepared this batch — as a Super Admin you can approve it
            yourself.
          </Banner>
        )}
        {b.status === "Returned to maker" && (
          <Banner tone="fail">
            Returned by {b.checker}: {b.returnReason}
          </Banner>
        )}
        {b.status === "Processing" && (
          <Banner
            tone="info"
            icon={<LoaderCircle size={20} className="animate-spin" />}
          >
            Sending transfers to banks…
          </Banner>
        )}
        {b.status === "Partial" && (
          <Banner tone="warn">
            {failed} transfer{failed === 1 ? "" : "s"} failed. Retry them below,
            or mark as paid with proof.
          </Banner>
        )}

        <div className="grid gap-3.5 md:grid-cols-4">
          <Kpi
            label="Members in batch"
            value={b.count.toLocaleString()}
            note={`${b.rows.length.toLocaleString()} of ${b.count.toLocaleString()}`}
          />
          <Kpi label="Savings" value={formatNaira(b.savingsKobo)} />
          <Kpi label="Interest" value={formatNaira(b.interestKobo)} />
          <Kpi
            label="Total payout"
            value={formatNaira(b.savingsKobo + b.interestKobo)}
            note={b.status === "Completed" ? "All paid" : `${failed} failed`}
            tone={
              b.status === "Completed" ? "good" : failed ? "warn" : undefined
            }
          />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chips<Tab>
                value={tab}
                onChange={setTab}
                options={[
                  { value: "All", label: `All ${count("All")}` },
                  { value: "Paid", label: `Paid ${count("Paid")}` },
                  { value: "Failed", label: `Failed ${count("Failed")}` },
                  { value: "Pending", label: `Pending ${count("Pending")}` },
                ]}
              />
              <div className="ml-auto flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <label className="flex h-10 w-full sm:w-56 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
                  <Search size={16} />
                  <input
                    className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                    placeholder="Search member"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <Select
                  aria-label="Sort rows"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  options={[
                    { value: "failed", label: "Failed first" },
                    { value: "name", label: "Name A–Z" },
                    { value: "amount", label: "Largest amount" },
                  ]}
                />
              </div>
            </div>
            <DataTable<PayoutRow>
              rows={rows}
              rowKey={(r) => r.memberId}
              columns={[
                {
                  header: "Member",
                  render: (r) => (
                    <span className="flex flex-col">
                      <b>{r.memberName}</b>
                      <span className="font-mono text-xs text-mute">
                        {r.memberId}
                      </span>
                    </span>
                  ),
                },
                {
                  header: "Savings",
                  align: "right",
                  render: (r) => formatNaira(r.savingsKobo),
                },
                {
                  header: "Interest",
                  align: "right",
                  render: (r) => formatNaira(r.interestKobo),
                },
                {
                  header: "Payout",
                  align: "right",
                  render: (r) => <b>{formatNaira(r.totalKobo)}</b>,
                },
                {
                  header: "Account",
                  render: (r) => (
                    <span className="text-sm text-mute">{r.account}</span>
                  ),
                },
                {
                  header: "Status",
                  render: (r) => (
                    <span className="flex flex-col items-start gap-1">
                      <Pill tone={ROW_TONE[r.status]}>{r.status}</Pill>
                      {r.status === "Failed" && r.reason && (
                        <span className="text-xs font-semibold text-fail">
                          {r.reason}
                        </span>
                      )}
                      {r.proof && (
                        <span className="text-xs font-semibold text-mute">
                          {r.proof}
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  header: "Action",
                  render: (r) =>
                    r.status === "Failed" ? (
                      <span className="flex gap-1.5">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () =>
                                repos.admin.retryPayout(
                                  b.id,
                                  r.memberId,
                                  adminName,
                                ),
                              `Transfer to ${r.memberName} succeeded.`,
                            )
                          }
                        >
                          Retry
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setManual(r);
                            setMethod("Bank transfer");
                            setProof("");
                            setNote("");
                          }}
                        >
                          Mark paid
                        </Button>
                      </span>
                    ) : null,
                },
              ]}
            />
          </div>
          <Card className="flex w-full shrink-0 flex-col gap-1 lg:w-80">
            <h2 className="mb-1 text-base font-extrabold">History</h2>
            {[...b.history].reverse().map(([at, ev, who], i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 border-b border-line py-2.5 text-sm last:border-b-0"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand-dark">
                  <Check size={14} />
                </span>
                <span className="flex-1 font-semibold">
                  {ev}
                  <span className="block text-xs font-semibold text-mute">
                    {who} · {at.slice(0, 16).replace("T", " ")}
                  </span>
                </span>
              </div>
            ))}
          </Card>
        </div>
        <p className="text-[13px] font-semibold text-mute">
          Interest approved in{" "}
          <Link
            to={paths.admin.interestYear(b.year)}
            className="font-bold text-brand underline underline-offset-2"
          >
            savings year {b.year}
          </Link>
        </p>
      </div>

      <Modal
        open={approveOpen}
        title={`Approve batch ${b.id}`}
        onClose={() => setApproveOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!reviewed || busy}
              title={reviewed ? undefined : "Tick the review box first"}
              onClick={() =>
                act(
                  () =>
                    repos.admin
                      .decideBatch(b.id, "Approved", {
                        by: adminName,
                        role: admin?.role,
                      })
                      .then((nb) => {
                        audit(
                          "Approved payout batch",
                          b.id,
                          `${formatNaira(b.savingsKobo + b.interestKobo)} · ${b.count} members`,
                        );
                        return nb;
                      }),
                  "Batch approved. Start disbursement.",
                  () => setApproveOpen(false),
                )
              }
            >
              Approve
            </Button>
          </>
        }
      >
        <p className="leading-relaxed text-[#474252]">
          {formatNaira(b.savingsKobo + b.interestKobo)} to{" "}
          {b.count.toLocaleString()} members. Prepared by {b.maker}.
        </p>
        <Checkbox checked={reviewed} onChange={setReviewed}>
          I’ve reviewed the batch totals and member rows.
        </Checkbox>
      </Modal>

      <Modal
        open={rejectOpen}
        title="Return batch to maker"
        onClose={() => setRejectOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim() || busy}
              onClick={() =>
                act(
                  () =>
                    repos.admin
                      .decideBatch(b.id, "Returned", {
                        by: adminName,
                        role: admin?.role,
                        reason,
                      })
                      .then((nb) => {
                        audit("Returned payout batch", b.id, reason);
                        return nb;
                      }),
                  `Batch returned to ${b.maker}.`,
                  () => {
                    setRejectOpen(false);
                    setReason("");
                  },
                )
              }
            >
              Return to maker
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Reason (sent to the maker)
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required"
            className="w-full rounded-input border-[1.5px] border-line bg-white p-3.5 text-[15px] font-semibold outline-none focus:border-brand"
          />
        </label>
      </Modal>

      <Modal
        open={!!manual}
        title={`Mark ${manual?.memberName} as paid`}
        onClose={() => setManual(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setManual(null)}>
              Cancel
            </Button>
            <Button
              disabled={!proof || !note.trim() || busy}
              onClick={() =>
                manual &&
                act(
                  () =>
                    repos.admin
                      .markPayoutPaid(b.id, manual.memberId, {
                        method,
                        proof,
                        note,
                        by: adminName,
                      })
                      .then((nb) => {
                        audit(
                          "Marked payout as paid manually",
                          manual.reference,
                          `${method} · ${proof}`,
                        );
                        return nb;
                      }),
                  `${manual.memberName} marked as paid.`,
                  () => setManual(null),
                )
              }
            >
              Confirm
            </Button>
          </>
        }
      >
        {manual && (
          <>
            <Card tone="soft">
              <p className="text-sm font-semibold">
                {formatNaira(manual.totalKobo)} · failed because:{" "}
                {manual.reason}
              </p>
            </Card>
            <SelectField
              label="Method"
              options={[
                "Bank transfer",
                "Cheque",
                "Cash (with signed receipt)",
              ]}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            />
            <label className="flex cursor-pointer items-center gap-2.5 rounded-input border-[1.5px] border-dashed border-line bg-white px-3.5 py-3 text-sm font-semibold text-mute">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setProof(e.target.files?.[0]?.name ?? "")}
              />
              {proof ? (
                <b className="text-ink">{proof}</b>
              ) : (
                "Upload proof (PDF, JPG or PNG)"
              )}
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold">
              Note
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Required"
                className="w-full rounded-input border-[1.5px] border-line bg-white p-3.5 text-[15px] font-semibold outline-none focus:border-brand"
              />
            </label>
          </>
        )}
      </Modal>
    </>
  );
}
