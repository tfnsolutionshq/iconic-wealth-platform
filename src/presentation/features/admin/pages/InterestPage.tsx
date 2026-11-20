import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LoaderCircle, Plus } from "lucide-react";
import type { InterestWorkflow, InterestYearSummary } from "@/domain/entities";
import {
  formatNaira,
  INTEREST_WIZARD_LABELS,
  interestWizardProgress,
} from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { Button, Card, DataTable, Modal, Pill } from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";

export const INTEREST_STAGES: string[] = [...INTEREST_WIZARD_LABELS];
const STATUS_TONE = {
  "Not started": "mute",
  Draft: "info",
  Submitted: "info",
  "Pending approval": "pending",
  Returned: "fail",
  Approved: "ok",
  "Paid out": "ok",
} as const;

/** The savings year we are currently in. Used when no configuration exists yet. */
const CURRENT_YEAR = new Date().getFullYear();

/** A List Config row, optionally the synthesised current-year placeholder. */
interface InterestRow extends InterestYearSummary {
  placeholder?: boolean;
}

/**
 * A virtual List Config row for the current year. The prototype always shows a
 * "Not started" row for the active year; the real backend only returns rows
 * once a configuration exists, so we synthesise the same row here. Its missing
 * `id` makes the year the workflow route id until the server creates the config.
 */
const currentYearPlaceholder = (): InterestRow => ({
  year: CURRENT_YEAR,
  status: "Not started",
  rate: null,
  eligible: 0,
  forfeited: 0,
  contributionsKobo: 0,
  interestKobo: 0,
  placeholder: true,
});

/** Matches the prototype's `DAY()` display, e.g. 2 Oct 2026. */
const formatApprovedAt = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

/** ADM-15: one interest configuration per savings year. */
export function InterestPage() {
  const { repos } = useServices();
  const navigate = useNavigate();
  const [years, setYears] = useState<InterestRow[]>([]);
  const [workflow, setWorkflow] = useState<InterestWorkflow | null>(null);
  const [done, setDone] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const current = years.find((y) => y.year === CURRENT_YEAR);

  useEffect(() => {
    let live = true;
    setLoading(true);
    repos.admin
      .listInterest()
      .then((data) => {
        if (!live) return;
        // Show one row for the active year even before a config exists on the
        // server, exactly like the prototype's always-present current-year row.
        const rows = data.some((y) => y.year === CURRENT_YEAR)
          ? data
          : [...data, currentYearPlaceholder()];
        setYears(rows);
        const target = rows.find((y) => y.year === CURRENT_YEAR);
        return repos.admin
          .getInterest(target?.id ?? CURRENT_YEAR)
          .then(
            ({ workflow: currentWorkflow }) => {
              if (!live) return;
              setWorkflow(currentWorkflow);
              setDone(interestWizardProgress(currentWorkflow).done);
            },
            () => {
              if (live) {
                setWorkflow(null);
                setDone(0);
              }
            },
          );
      })
      .catch(() => {
        if (live) setYears([]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [repos]);

  const configId = (y: InterestYearSummary) => y.id ?? y.year;

  /**
   * The list endpoint can lag behind the workflow endpoint. For the current
   * year prefer the fetched workflow's status so the row reflects what the
   * configuration actually is (e.g. "Submitted") rather than "Not started".
   */
  const statusOf = (y: InterestYearSummary) =>
    y.year === CURRENT_YEAR && workflow ? workflow.status : y.status;
  const statusLabelOf = (y: InterestYearSummary) =>
    y.year === CURRENT_YEAR && workflow
      ? workflow.statusLabel || workflow.status
      : y.status;

  const progress = (y: InterestYearSummary) => {
    const status = statusOf(y);
    if (y.year !== CURRENT_YEAR) return "Closed";
    if (status === "Not started") return "—";
    if (status === "Paid out") return "Paid out";
    return done >= 8
      ? "All stages done"
      : `Stage ${Math.min(8, done + 1)} of 8 · ${INTEREST_STAGES[Math.min(7, done)]}`;
  };

  const cta = (y: InterestYearSummary) => {
    if (y.year !== CURRENT_YEAR) return "View";
    return statusOf(y) === "Not started" ? "Start configuration" : "Continue";
  };

  const newConfig = async () => {
    if (current && statusOf(current) !== "Not started") setConfirm(true);
    else navigate(paths.admin.interestConfig(current?.id ?? CURRENT_YEAR));
  };

  return (
    <>
      <AdminPageHeader
        title="Interest"
        sub="One configuration per savings year. Closed years are read-only."
        actions={
          <Button size="md" icon={<Plus size={18} />} onClick={newConfig}>
            New interest configuration
          </Button>
        }
      />
      <div className="flex flex-col gap-5 px-4 py-5 sm:px-8 sm:py-6">
        <Card className="flex flex-col gap-2.5">
          <h2 className="text-base font-extrabold">How a configuration runs</h2>
          <div className="flex items-start gap-2 overflow-x-auto pb-1">
            {INTEREST_STAGES.map((s, i) => {
              const stageDone = i < done;
              const stageCurrent =
                i === done &&
                (current ? statusOf(current) !== "Not started" : false);
              return (
                <div
                  key={s}
                  className="flex min-w-16 flex-1 flex-col gap-2 text-xs font-bold"
                >
                  <i
                    className={`h-1.5 rounded-full ${stageDone ? "bg-brand" : stageCurrent ? "bg-[#F6A623]" : "bg-line"}`}
                  />
                  <span
                    className={
                      stageDone || stageCurrent ? "text-ink" : "text-mute"
                    }
                  >
                    {i + 1}. {s}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[13px] font-semibold leading-relaxed text-mute">
            The maker (Administrator) sets the period and rate, runs the
            calculation and submits it. A different person (Super Admin)
            approves or returns it. Approval creates the payout batch.
          </p>
        </Card>

        {loading ? (
          <Card
            role="status"
            aria-live="polite"
            className="flex min-h-48 items-center justify-center gap-2"
          >
            <LoaderCircle className="animate-spin text-brand" size={18} />
            <p className="text-sm font-semibold text-mute">
              Loading interest configurations…
            </p>
          </Card>
        ) : (
          <DataTable<InterestRow>
            padding="relaxed"
            rows={[...years].sort((a, b) => b.year - a.year)}
            rowKey={(r) => String(r.id ?? r.year)}
            onRowClick={(r) => navigate(paths.admin.interestConfig(configId(r)))}
            columns={[
              { header: "Year", render: (y) => <b>Savings year {y.year}</b> },
              {
                header: "Status",
                render: (y) => (
                  <Pill tone={STATUS_TONE[statusOf(y)]} icon={false}>
                    {statusLabelOf(y)}
                  </Pill>
                ),
              },
              {
                header: "Progress",
                render: (y) => (
                  <span className="text-mute">
                    {y.placeholder ? "—" : progress(y)}
                  </span>
                ),
              },
              {
                header: "Rate",
                align: "right",
                render: (y) =>
                  y.placeholder
                    ? "—"
                    : y.rateMode === "Contribution ranges"
                      ? "By range"
                      : y.rate != null
                        ? `${y.rate}%`
                        : "Not set",
              },
              {
                header: "Eligible members",
                align: "right",
                render: (y) =>
                  y.placeholder ? "—" : y.eligible.toLocaleString(),
              },
              {
                header: "Total interest",
                align: "right",
                render: (y) =>
                  y.placeholder
                    ? "—"
                    : y.interestKobo
                      ? <b>{formatNaira(y.interestKobo)}</b>
                      : "—",
              },
              {
                header: "Approved by",
                render: (y) => (
                  <span className="text-mute">
                    {y.placeholder
                      ? "—"
                      : y.checker
                        ? `${y.checker} · ${formatApprovedAt(y.approvedAt)}`
                        : "—"}
                  </span>
                ),
              },
              {
                header: "",
                render: (y) => (
                  <Button
                    size="sm"
                    variant={
                      y.year === CURRENT_YEAR && statusOf(y) === "Not started"
                        ? "primary"
                        : "outline"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(paths.admin.interestConfig(configId(y)));
                    }}
                  >
                    {cta(y)}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </div>

      <Modal
        open={confirm}
        title={`${CURRENT_YEAR} is already configured`}
        onClose={() => setConfirm(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                navigate(paths.admin.interestConfig(current?.id ?? CURRENT_YEAR))
              }
            >
              Open {CURRENT_YEAR}
            </Button>
          </>
        }
      >
        <p className="leading-relaxed text-[#474252]">
          There is already an interest configuration for savings year{" "}
          {CURRENT_YEAR}. There can only be one per year.
        </p>
      </Modal>
    </>
  );
}
