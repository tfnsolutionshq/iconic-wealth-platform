import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Check,
  ChevronDown,
  Clock,
  Download,
  LoaderCircle,
  Lock,
  Percent,
  RefreshCw,
  Search,
  Shield,
  X,
} from "lucide-react";
import type {
  AuditCategory,
  Eligibility,
  InterestBand,
  InterestCalcRow,
  InterestCalculationEntries,
  InterestNotifyChannel,
  InterestRateMode,
  InterestScope,
  InterestWorkflow,
  MemberListRow,
} from "@/domain/entities";
import {
  formatNaira,
  interestWizardProgress,
  interestWizardSteps,
  parseNairaInput,
} from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Chips,
  cn,
  DataTable,
  Kpi,
  Modal,
  OpenDecisionTag,
  Pill,
  SelectField,
  TextField,
} from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";
import { downloadCsv } from "../../../utils/csv";

const STATUS_TONE = {
  "Not started": "mute",
  Draft: "info",
  Submitted: "info",
  "Pending approval": "pending",
  Returned: "fail",
  Approved: "ok",
  "Paid out": "ok",
} as const;
const LOCKED = ["Submitted", "Pending approval", "Approved", "Paid out"];
const MIN_BAND_KOBO = parseNairaInput("10000");
/** UI checkbox keys mapped to the API's notification channel values. */
const NOTIFY_CHANNELS = {
  InApp: "in_app",
  Email: "email",
  WhatsApp: "whatsapp",
} as const satisfies Record<string, InterestNotifyChannel>;

/** Both calculation responses are cached together, under one config key. */
type InterestCalculationCache = {
  calculation: InterestWorkflow;
  entries: InterestCalculationEntries;
};

const interestCalculationKey = (id: string) =>
  `iwh:interest-calculation:${encodeURIComponent(id || "current")}`;

/**
 * A year route can be opened before a configuration exists. Once step 2 creates
 * the real config we remember its id so a refresh of the year URL still loads
 * the server record instead of falling back to a fresh draft.
 */
const interestConfigIdKey = (year: number) => `iwh:interest-config-id:${year}`;
function readStoredConfigId(year: number): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(interestConfigIdKey(year));
  } catch {
    return null;
  }
}
function writeStoredConfigId(year: number, id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(interestConfigIdKey(year), id);
  } catch {
    // Storage can be disabled; the in-memory id still drives this session.
  }
}

function readCalculationCache(id: string): InterestCalculationCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(interestCalculationKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InterestCalculationCache> | null;
    const calculation = parsed?.calculation;
    const entries = parsed?.entries;
    if (
      !calculation ||
      typeof calculation !== "object" ||
      calculation.calc !== true ||
      typeof calculation.interestKobo !== "number" ||
      typeof calculation.eligible !== "number" ||
      !entries ||
      typeof entries !== "object" ||
      !Array.isArray(entries.entries) ||
      !entries.summary ||
      typeof entries.summary.interestKobo !== "number"
    ) {
      return null;
    }
    return parsed as InterestCalculationCache;
  } catch {
    return null;
  }
}

function writeCalculationCache(id: string, cache: InterestCalculationCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      interestCalculationKey(id),
      JSON.stringify(cache),
    );
  } catch {
    // Storage can be disabled or full; the responses still drive the UI.
  }
}

/** Keeps the maker's inputs while adopting the authoritative calculation totals. */
function mergeCalculationResult(
  prev: InterestWorkflow,
  result: InterestWorkflow,
  entries?: InterestCalculationEntries,
): InterestWorkflow {
  // The config id and savings year are not always the same value; prefer the
  // year from the calculation period when the API did not return one directly.
  const periodYear = Number(result.start?.slice(0, 4));
  return {
    ...prev,
    year: periodYear || result.year || prev.year,
    rate: result.rate ?? prev.rate,
    rateMode: result.bands?.length ? result.rateMode : prev.rateMode,
    bands: result.bands?.length ? result.bands : prev.bands,
    start: result.start || prev.start,
    end: result.end || prev.end,
    close: result.close || prev.close,
    scope: result.scope ?? prev.scope,
    eligible: entries?.summary.eligible ?? result.eligible ?? prev.eligible,
    forfeited: entries?.summary.forfeited ?? result.forfeited ?? prev.forfeited,
    contributionsKobo:
      entries?.summary.eligibleContributionsKobo ??
      result.contributionsKobo ??
      prev.contributionsKobo,
    interestKobo:
      entries?.summary.interestKobo ?? result.interestKobo ?? prev.interestKobo,
    calc: true,
    done: Math.max(prev.done, result.done, 3),
    stage: Math.max(prev.stage, result.stage, 4),
    currentStage: result.currentStage ?? prev.currentStage ?? "submit",
    completedStages: Array.from(
      new Set([
        ...prev.completedStages,
        ...result.completedStages,
        "calculate",
      ]),
    ),
    calculationRunAt: result.calculationRunAt ?? prev.calculationRunAt,
    history: result.history?.length ? result.history : prev.history,
    selectedMemberIds: result.selectedMemberIds?.length
      ? result.selectedMemberIds
      : prev.selectedMemberIds,
  };
}

/** Idempotency check so restoring a result cannot loop on every render. */
function calculationFieldsMatch(
  a: InterestWorkflow,
  b: InterestWorkflow,
): boolean {
  return (
    a.calc === b.calc &&
    a.interestKobo === b.interestKobo &&
    a.eligible === b.eligible &&
    a.forfeited === b.forfeited &&
    a.contributionsKobo === b.contributionsKobo &&
    a.start === b.start &&
    a.end === b.end &&
    a.rate === b.rate &&
    a.done === b.done &&
    a.bands?.length === b.bands?.length
  );
}

/** Avoids replacing the preview array when the cached rows are already shown. */
function samePreviewRows(a: InterestCalcRow[], b: InterestCalcRow[]): boolean {
  return (
    a.length === b.length && a.every((row, i) => row.memberId === b[i].memberId)
  );
}

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
/** Matches the prototype's `DAY()` display, e.g. 19 Nov 2026. */
const formatApprovalDate = (value?: string | null) => {
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

/** Human labels for the event keys returned by GET /admin/interest/{id}/history. */
const INTEREST_HISTORY_ACTIONS: Record<string, string> = {
  "interest.config.created": "Interest configuration created",
  "interest.config.calculated": "Interest configuration calculated",
  "interest.config.submitted": "Interest configuration submitted",
  "interest.config.approved": "Interest configuration approved",
  "interest.payout.batch-created": "Payout batch created",
  "interest.config.members-notified": "Members notified",
};
const historyAction = (event: string) =>
  INTEREST_HISTORY_ACTIONS[event] ?? event;

/** e.g. 2026-11-19T09:46:55+00:00 -> 19 Nov 2026 • 09:46. */
const formatHistoryDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })} • ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
};
function BandSummary({ bands }: { bands: InterestBand[] }) {
  if (!bands.length) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border-[1.5px] border-line bg-soft p-3 text-sm">
      {bands.map((b, i) => (
        <div key={i} className="flex justify-between gap-3">
          <span className="font-semibold text-mute">
            {formatNaira(b.minKobo)} –{" "}
            {b.maxKobo == null ? "No limit" : formatNaira(b.maxKobo)}
          </span>
          <b>{b.rate}%</b>
        </div>
      ))}
    </div>
  );
}

/** ADM-16, ADM-17: 8-stage maker-checker interest workflow. Past years are read-only. */
export function InterestWorkflowPage() {
  const { interestConfigId } = useParams();
  const interestConfigIdValue = interestConfigId ?? "";
  /** A 4-digit route id is a savings year, which may not have a config yet. */
  const draftYear = /^\d{4}$/.test(interestConfigIdValue)
    ? Number(interestConfigIdValue)
    : null;
  /** The id used for API calls; swapped to the real config id after step 2. */
  const [activeId, setActiveId] = useState<string>(
    () =>
      (draftYear != null ? readStoredConfigId(draftYear) : null) ??
      interestConfigIdValue,
  );
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
  /** The prototype creates the batch locally; no backend call is involved. */
  const [payoutBatchCreated, setPayoutBatchCreated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [period, setPeriod] = useState({ start: "", end: "", close: "" }); // kept for backward compatibility
  const [config, setConfig] = useState<{
    savings_start: string;
    savings_end: string;
    contribution_close: string;
    rate: number;
    rounding: string;
    applies_to: string;
    proportional_basis: boolean;
  }>({
    savings_start: "",
    savings_end: "",
    contribution_close: "",
    rate: 0,
    rounding: "Nearest naira",
    applies_to: "all",
    proportional_basis: true,
  });
  const [rateMode, setRateMode] = useState<InterestRateMode>("Fixed rate");
  const [bands, setBands] = useState<BandDraft[]>([
    { min: "10000", max: "", rate: "" },
  ]);
  const [rate, setRate] = useState("");
  const [rounding, setRounding] = useState("Nearest naira");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [channels, setChannels] = useState<Record<keyof typeof NOTIFY_CHANNELS, boolean>>({
    InApp: true,
    Email: true,
    WhatsApp: true,
  });
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<InterestScope>("All members");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerEligibility, setPickerEligibility] =
    useState<PickerEligibility>("All");
  const [pickerMembers, setPickerMembers] = useState<MemberListRow[]>([]);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [members, setMembers] = useState<MemberListRow[]>([]);
  const [membersBusy, setMembersBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  /** Event log loaded from GET /admin/interest/{id}/history for step 8. */
  const [interestHistory, setInterestHistory] = useState<
    [string, string, string][]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  /** Guards against refetching the same calculation on repeated renders. */
  const calculationFetchRef = useRef<string | null>(null);

  /**
   * Local starting point when `GET /admin/interest/{id}` finds no configuration
   * for the current year. Steps 1 and 2 fill this in, then step 2's
   * `createInterestConfig` call creates the real server record.
   */
  const createDraftWorkflow = (): InterestWorkflow => {
    const year = draftYear ?? new Date().getFullYear();
    return {
      year,
      status: "Not started",
      statusLabel: "Not started",
      rate: null,
      rateMode: "Fixed rate",
      eligible: 0,
      forfeited: 0,
      contributionsKobo: 0,
      interestKobo: 0,
      closed: false,
      stage: 1,
      done: 0,
      start: `${year}-01-01`,
      end: `${year}-11-30`,
      close: `${year + 1}-01-05`,
      rounding: "Nearest naira",
      bands: [],
      scope: "All members",
      selectedMemberIds: [],
      excludedMemberIds: [],
      calc: false,
      note: "",
      notified: false,
      history: [],
      currentStage: null,
      completedStages: [],
      stages: [],
      calculationRunAt: null,
      createdBy: null,
      submittedBy: null,
      reviewedBy: null,
      submittedAt: null,
      reviewedAt: null,
    };
  };

  const buildInterestConfigPayload = () => {
    const yearValue = Number(
      w?.year ?? (activeId || new Date().getFullYear()),
    );
    const payload: {
      year: number;
      savings_start: string;
      savings_end: string;
      contribution_close: string;
      rate: number;
      rounding: string;
      applies_to: string;
      proportional_basis: boolean;
      rate_type?: "fixed" | "range";
      ranges?: {
        from_amount: number | null;
        to_amount: number | null;
        rate: number;
      }[];
      member_ids?: string[];
    } = {
      year: yearValue,
      savings_start: config.savings_start || w?.start || "",
      savings_end: config.savings_end || w?.end || "",
      contribution_close: config.contribution_close || w?.close || "",
      rate:
        rateMode === "Fixed rate"
          ? Number(rate || 0)
          : Number(bands[0]?.rate || 0),
      rounding: rounding === "Nearest kobo" ? "kobo" : "naira",
      applies_to: scope === "Selected members" ? "selected" : "all",
      proportional_basis: true,
    };

    if (scope === "Selected members" && selectedIds.length > 0) {
      payload.member_ids = selectedIds;
    }

    if (rateMode === "Contribution ranges") {
      payload.rate_type = "range";
      payload.ranges = bands.map((b) => ({
        from_amount: Number((b.min || "0").replace(/[^\d]/g, "")) || null,
        to_amount:
          b.max.trim() === ""
            ? null
            : Number((b.max || "0").replace(/[^\d]/g, "")) || null,
        rate: Number(b.rate || 0),
      }));
    } else {
      payload.rate_type = "fixed";
    }

    return payload;
  };

  /** Applies a workflow payload (fetched or returned by an action) to the wizard. */
  const applyWorkflow = (
    d: { workflow: InterestWorkflow; preview?: InterestCalcRow[] },
    keepStage?: number,
  ) => {
    setW(d.workflow);
    if (d.preview) setPreview(d.preview);
    setStage(keepStage ?? interestWizardProgress(d.workflow).stage);
    setPeriod({
      start: d.workflow.start,
      end: d.workflow.end,
      close: d.workflow.close,
    });
    setRate(d.workflow.rate != null ? String(d.workflow.rate) : "");
    setRateMode(d.workflow.rateMode ?? "Fixed rate");
    setBands(
      d.workflow.bands?.length
        ? d.workflow.bands.map(bandToDraft)
        : [{ min: "10000", max: "", rate: "" }],
    );
    setRounding(d.workflow.rounding);
    setNote(d.workflow.note);
    setScope(d.workflow.scope);
    setSelectedIds(d.workflow.selectedMemberIds);
    setConfig({
      savings_start: d.workflow.start,
      savings_end: d.workflow.end,
      contribution_close: d.workflow.close,
      rate: d.workflow.rate ?? 0,
      rounding: d.workflow.rounding,
      applies_to: d.workflow.scope === "Selected members" ? "selected" : "all",
      proportional_basis: true,
    });
  };

  const reload = async (keepStage?: number) => {
    setLoading(true);
    try {
      const d = await repos.admin.getInterest(activeId);
      applyWorkflow(d, keepStage);
    } catch {
      if (draftYear == null) {
        setMissing(true);
        return;
      }
      // No configuration exists for this year yet. Start a local draft so the
      // admin can complete steps 1 and 2, which create the real configuration.
      applyWorkflow({ workflow: createDraftWorkflow() }, keepStage ?? 1);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setMissing(false);
    reload();
    // `activeId` is intentionally omitted: it changes only after step 2 creates
    // the config, and that handler adopts the returned workflow directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, interestConfigIdValue]);

  /**
   * Whenever the calculation stage is already complete, show the stored
   * calculation + entries. If they were never stored, rerun both endpoints once
   * and cache the pair under the same object.
   */
  useEffect(() => {
    if (!w || w.done < 3) return;
    const key = activeId || String(w.year);
    const stored = readCalculationCache(key);
    if (stored) {
      const expected = mergeCalculationResult(
        w,
        stored.calculation,
        stored.entries,
      );
      const needsWorkflow = !calculationFieldsMatch(w, expected);
      if (needsWorkflow) setW(expected);
      if (needsWorkflow || !samePreviewRows(preview, stored.entries.entries)) {
        setPreview(stored.entries.entries);
      }
      return;
    }
    if (calculationFetchRef.current === key) return;
    calculationFetchRef.current = key;
    setBusy(true);
    repos.admin
      .runInterestCalculation(key)
      .then((calculation) =>
        repos.admin.getInterestEntries(key).then((entries) => ({
          calculation,
          entries,
        })),
      )
      .then((cache) => {
        writeCalculationCache(key, cache);
        setW((prev) =>
          prev
            ? mergeCalculationResult(prev, cache.calculation, cache.entries)
            : cache.calculation,
        );
        setPreview(cache.entries.entries);
      })
      .catch((e) => toast((e as Error).message))
      .finally(() => setBusy(false));
  }, [w, preview, activeId, repos, toast]);

  const audit = (
    action: string,
    entity: string,
    change: string,
    category: AuditCategory = "Financial",
  ): Promise<void> => {
    if (!admin) return Promise.resolve();
    return repos.admin
      .logAudit({
        at: clock.now().toISOString(),
        actor: admin.name,
        role: roleLabel(admin.role),
        action,
        entity,
        change,
        category,
      })
      .then(() => {});
  };

  /** Runs an action, then adopts the workflow's own stage so the wizard advances automatically (submit → approval → batch → notify → history). */
  const run = async (
    fn: () => Promise<unknown>,
    ok: (result?: unknown) => void,
    done: string,
    options: { reloadAfter?: boolean } = {},
  ) => {
    setBusy(true);
    try {
      const result = await fn();
      if (options.reloadAfter !== false) await reload();
      toast(done);
      ok(result);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return preview.filter(
      (p) => !s || `${p.memberName} ${p.memberId}`.toLowerCase().includes(s),
    );
  }, [preview, q]);

  const pickerCounts = useMemo(
    () => ({
      All: pickerMembers.length,
      Eligible: pickerMembers.filter((m) => m.eligibility === "Eligible")
        .length,
      Forfeited: pickerMembers.filter((m) => m.eligibility === "Forfeited")
        .length,
    }),
    [pickerMembers],
  );

  const pickerFiltered = useMemo(() => {
    const s = pickerQuery.trim().toLowerCase();
    return pickerMembers
      .filter(
        (m) =>
          pickerEligibility === "All" || m.eligibility === pickerEligibility,
      )
      .filter((m) => !s || `${m.name} ${m.id}`.toLowerCase().includes(s));
  }, [pickerMembers, pickerQuery, pickerEligibility]);

  const selectedMembers = useMemo(
    () =>
      (scope === "All members"
        ? members
        : members.filter((m) => selectedIds.includes(m.id))
      ).filter((m) => !(w?.excludedMemberIds ?? []).includes(m.id)),
    [scope, members, selectedIds, w?.excludedMemberIds],
  );
  const selectedCount = selectedMembers.length;

  useEffect(() => {
    if (stage !== 2 || members.length > 0) return;
    let live = true;
    setMembersBusy(true);
    repos.admin
      .listMembers({ tab: "All", search: "" })
      .then((page) => {
        if (live) setMembers(page.data);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setMembersBusy(false);
      });
    return () => {
      live = false;
    };
  }, [stage, members.length, repos.admin]);

  useEffect(() => {
    if (stage !== 8) return;
    let live = true;
    setHistoryLoading(true);
    repos.admin
      .getInterestHistory(activeId)
      .then((rows) => {
        if (live) setInterestHistory(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setHistoryLoading(false);
      });
    return () => {
      live = false;
    };
  }, [stage, activeId, repos.admin]);

  const openPicker = async () => {
    setPickerOpen(true);
    setPickerQuery("");
    setPickerEligibility("All");
    setDraftIds(selectedIds);
    if (pickerMembers.length === 0) {
      setPickerBusy(true);
      try {
        setPickerMembers(
          (await repos.admin.listMembers({ tab: "All", search: "" })).data,
        );
      } catch (e) {
        toast((e as Error).message);
      } finally {
        setPickerBusy(false);
      }
    }
  };

  if (loading) {
    return (
      <>
        <AdminPageHeader title="Interest" back={paths.admin.interest} />
        <div className="flex min-h-48 items-center justify-center px-4 py-5 sm:px-8 sm:py-6">
          <Card
            role="status"
            aria-live="polite"
            className="flex w-full max-w-xl items-center justify-center gap-2 p-6"
          >
            <LoaderCircle className="animate-spin text-brand" size={18} />
            <p className="text-sm font-semibold text-mute">
              Loading interest configuration…
            </p>
          </Card>
        </div>
      </>
    );
  }

  if (missing) {
    return (
      <>
        <AdminPageHeader title="Not found" back={paths.admin.interest} />
        <p className="p-8 text-mute">
          No interest configuration for this year.
        </p>
      </>
    );
  }
  if (!w)
    return (
      <>
        <AdminPageHeader title="Interest" back={paths.admin.interest} />
        <p className="p-8 text-mute">Loading…</p>
      </>
    );

  /** The list endpoint does not expose a batch id, so mirror the prototype's PB-<year>-12. */
  const payoutBatchId = w.batchId ?? `PB-${w.year}-12`;
  const payoutBatchPath = paths.admin.payoutBatch(payoutBatchId, {
    interestConfigId: activeId,
    year: w.year,
  });

  /* ---------- closed years: read-only ---------- */
  if (w.closed) {
    return (
      <>
        <AdminPageHeader
          title={`Interest · savings year ${w.year}`}
          sub="Closed period · read-only"
          back={paths.admin.interest}
        />
        <div className="flex flex-col gap-5 px-4 py-5 sm:px-8 sm:py-6">
          <Banner tone="neutral" icon={<Lock size={20} />}>
            This period is closed. Figures below are the approved record.
          </Banner>
          <div className="grid gap-3.5 md:grid-cols-4">
            <Kpi label="Rate applied" value={rateLabel(w)} />
            <Kpi
              label="Eligible members"
              value={w.eligible.toLocaleString()}
              note={`${w.forfeited} forfeited`}
            />
            <Kpi
              label="Eligible contributions"
              value={formatNaira(w.contributionsKobo)}
            />
            <Kpi
              label="Total interest"
              value={formatNaira(w.interestKobo)}
              note="Paid out"
              tone="good"
            />
          </div>
          <Card className="flex flex-col gap-1">
            <h2 className="text-base font-extrabold">Approval</h2>
            <div className="flex justify-between gap-3 py-2 text-sm">
              <span className="font-semibold text-mute">Prepared by</span>
              <b>{w.maker}</b>
            </div>
            <div className="flex justify-between gap-3 py-2 text-sm">
              <span className="font-semibold text-mute">Approved by</span>
              <b>
                {w.checker ?? w.reviewedBy?.name ?? "—"} ·{" "}
                {formatApprovalDate(w.approvedAt ?? w.reviewedAt)}
              </b>
            </div>
            <div className="flex justify-between gap-3 py-2 text-sm">
              <span className="font-semibold text-mute">Payout batch</span>
              {w.batchId ? (
                <Link
                  to={payoutBatchPath}
                  className="font-bold text-brand underline underline-offset-2"
                >
                  {payoutBatchId}
                </Link>
              ) : (
                <b>—</b>
              )}
            </div>
          </Card>
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold">Members</h2>
              <label className="flex h-10 w-full items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute sm:ml-auto sm:w-64">
                <Search size={16} />
                <input
                  className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                  placeholder="Search member"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
            </div>
            <DataTable<InterestCalcRow>
              rows={filtered}
              rowKey={(r) => r.memberId}
              columns={[
                { header: "Member", render: (r) => <b>{r.memberName}</b> },
                {
                  header: "Savings",
                  align: "right",
                  render: (r) => formatNaira(r.contributionsKobo),
                },
                {
                  header: "Rate",
                  align: "right",
                  render: (r) => (r.rate != null ? `${r.rate}%` : "—"),
                },
                {
                  header: "Interest",
                  align: "right",
                  render: (r) => <b>{formatNaira(r.interestKobo)}</b>,
                },
                {
                  header: "Total paid",
                  align: "right",
                  render: (r) => (
                    <b>{formatNaira(r.contributionsKobo + r.interestKobo)}</b>
                  ),
                },
                {
                  header: "Payout status",
                  render: () => <Pill tone="ok">Paid</Pill>,
                },
              ]}
            />
          </Card>
        </div>
      </>
    );
  }

  /* ---------- current year: wizard ---------- */
  const locked = LOCKED.includes(w.status);
  /** The backend may report a submitted configuration as "Submitted" or "Pending approval". */
  const awaitingApproval =
    w.status === "Submitted" || w.status === "Pending approval";
  /** A step is finished once the backend has marked its stage complete. */
  const stepDone = (step: number) => step <= w.done;
  const batchCreated =
    payoutBatchCreated ||
    Boolean(w.batchId) ||
    w.done >= 6 ||
    w.status === "Paid out";
  const calculationDone = w.calc || stepDone(3);
  const hasRates =
    w.rateMode === "Contribution ranges"
      ? (w.bands ?? []).length > 0
      : w.rate != null;
  const isMaker = w.maker === adminName;
  /** ADM-16/17: a different Super Admin checks. Makers never check their own request. */
  const canCheck = isSuper && !isMaker;

  const savePeriod = () => {
    if (
      !config.savings_start ||
      !config.savings_end ||
      !config.contribution_close
    ) {
      toast("Please fill in all missing details in Step 1 before continuing.");
      return;
    }
    setStage(2);
  };
  const goToStage = (nextStage: number) => {
    if (nextStage <= stage) {
      setStage(nextStage);
      return;
    }

    if (nextStage === 2) {
      if (
        !config.savings_start ||
        !config.savings_end ||
        !config.contribution_close
      ) {
        toast(
          "Please fill in all missing details in Step 1 before continuing.",
        );
        return;
      }
    }

    if (nextStage === 3) {
      if (
        !config.savings_start ||
        !config.savings_end ||
        !config.contribution_close
      ) {
        toast(
          "Please fill in all missing details in Step 1 before continuing.",
        );
        return;
      }

      if (rateMode === "Fixed rate") {
        if (!rate || Number(rate) < 0.1 || Number(rate) > 30) {
          toast(
            "Please fill in all missing details in Step 2 before continuing.",
          );
          return;
        }
      } else {
        const parsedBands = bands
          .map((b) => ({
            minKobo: parseNairaInput(b.min),
            maxKobo: b.max.trim() === "" ? null : parseNairaInput(b.max),
            rate: Number(b.rate),
          }))
          .sort((a, b) => a.minKobo - b.minKobo);

        if (
          !parsedBands.length ||
          parsedBands.some((b) => b.minKobo <= 0) ||
          parsedBands.some(
            (b) =>
              !Number.isFinite(b.rate) ||
              b.rate < 0.1 ||
              b.rate > 30 ||
              (b.maxKobo != null && b.maxKobo <= b.minKobo),
          )
        ) {
          toast(
            "Please fill in all missing details in Step 2 before continuing.",
          );
          return;
        }
      }
    }

    setStage(nextStage);
  };

  const saveRules = () => {
    if (scope === "Selected members" && selectedIds.length === 0) {
      toast("Select at least one member, or apply interest to all members.");
      return;
    }

    let fixedRate = 0;
    let parsedBands: InterestBand[] = [];

    if (rateMode === "Fixed rate") {
      fixedRate = Number(rate);
      if (!Number.isFinite(fixedRate) || fixedRate < 0.1 || fixedRate > 30) {
        toast("Rate must be between 0.1% and 30%.");
        return;
      }
    } else {
      parsedBands = bands
        .map((b) => ({
          minKobo: parseNairaInput(b.min),
          maxKobo: b.max.trim() === "" ? null : parseNairaInput(b.max),
          rate: Number(b.rate),
        }))
        .sort((a, b) => a.minKobo - b.minKobo);

      if (!parsedBands.length) {
        toast("Add at least one contribution range.");
        return;
      }
      if (parsedBands.some((b) => b.minKobo <= 0)) {
        toast("Enter a starting amount for every range.");
        return;
      }
      if (parsedBands[0].minKobo !== MIN_BAND_KOBO) {
        toast("The lowest contribution range must start at ₦10,000.");
        return;
      }
      for (let i = 0; i < parsedBands.length; i++) {
        const b = parsedBands[i];
        if (!Number.isFinite(b.rate) || b.rate < 0.1 || b.rate > 30) {
          toast("Each range rate must be between 0.1% and 30%.");
          return;
        }
        if (b.maxKobo != null && b.maxKobo <= b.minKobo) {
          toast("Each range must end above where it starts.");
          return;
        }
        const prev = parsedBands[i - 1];
        if (prev) {
          if (prev.maxKobo == null) {
            toast("Only the last range can have no upper limit.");
            return;
          }
          if (b.minKobo <= prev.maxKobo) {
            toast("Contribution ranges must not overlap.");
            return;
          }
        }
      }
    }

    run(
      () =>
        repos.admin.createInterestConfig({
          ...buildInterestConfigPayload(),
          rate:
            rateMode === "Fixed rate" ? fixedRate : Number(bands[0]?.rate || 0),
        }),
      (result) => {
        const created = result as InterestWorkflow | undefined;
        if (!created) {
          setStage(3);
          return;
        }
        // Adopt the server record so every later endpoint uses the real config
        // id, while keeping step 1/2 inputs and advancing to Calculation.
        const createdId = created.id ? String(created.id) : null;
        setW((prev) => ({
          ...(prev ?? createDraftWorkflow()),
          ...created,
          year:
            created.year ||
            prev?.year ||
            draftYear ||
            new Date().getFullYear(),
          start: created.start || config.savings_start,
          end: created.end || config.savings_end,
          close: created.close || config.contribution_close,
          rate: created.rate ?? prev?.rate ?? fixedRate,
          done: Math.max(prev?.done ?? 0, 2),
          stage: 3,
        }));
        if (createdId) {
          setActiveId(createdId);
          if (draftYear != null) writeStoredConfigId(draftYear, createdId);
        }
        setStage(3);
      },
      "Configuration saved.",
      // The new id is adopted above; reloading the old year id would 404.
      { reloadAfter: false },
    );
  };
  const calculate = () =>
    run(
      () =>
        repos.admin
          .runInterestCalculation(activeId)
          .then((calculation) =>
            repos.admin
              .getInterestEntries(activeId)
              .then((entries) => {
                const cache = { calculation, entries };
                writeCalculationCache(activeId, cache);
                calculationFetchRef.current = activeId;
                return cache;
              }),
          ),
      (result) => {
        // Both responses are returned together; adopt them instead of a
        // follow-up GET that may not carry the fresh totals or member rows.
        const cache = result as InterestCalculationCache | undefined;
        if (!cache) {
          setStage(4);
          return;
        }
        applyWorkflow(
          {
            workflow: mergeCalculationResult(
              w,
              cache.calculation,
              cache.entries,
            ),
            preview: cache.entries.entries,
          },
          4,
        );
      },
      "Calculation complete.",
      { reloadAfter: false },
    );
  const removeMemberFromPreview = (m: Pick<MemberListRow, "id" | "name">) =>
    run(
      () =>
        repos.admin
          .setInterestExclusions(activeId, [
            ...(w.excludedMemberIds ?? []),
            m.id,
          ])
          .then((wf) =>
            audit(
              "Removed member from payout",
              m.id,
              `${m.name} · ${wf.eligibility} eligible`,
              "Financial",
            ),
          ),
      () => {},
      `${m.name} removed from payout.`,
    );
  const restorePayoutMembers = () =>
    run(
      () =>
        repos.admin
          .setInterestExclusions(activeId, [])
          .then((wf) =>
            audit(
              "Restored payout members",
              `Interest ${activeId}`,
              `${(w.excludedMemberIds ?? []).length} restored · ${wf.eligible} eligible`,
              "Financial",
            ),
          ),
      () => {},
      "Removed members restored.",
    );
  const submit = () =>
    run(
      () =>
        repos.admin
          .submitInterest(activeId, note, adminName)
          .then((wf) =>
            audit(
              "Submitted interest for approval",
              `Interest ${activeId}`,
              `${wf.eligible} eligible · ${rateLabel(wf)}`,
              "Financial",
            ),
          ),
      () => {},
      "Sent for approval.",
    );
  /** Defence in depth: the maker/checker split must hold even if a modal is opened stale. */
  const assertCanCheck = () => {
    if (!isSuper) throw new Error("Only a Super Admin can approve.");
    if (isMaker)
      throw new Error("You can’t approve or return a request you prepared.");
  };
  const approve = () =>
    run(
      () => {
        assertCanCheck();
        return repos.admin.decideInterest(activeId, "Approved", {
          by: adminName,
          role: admin?.role,
        });
      },
      () => setApproveOpen(false),
      "Configuration approved.",
    );
  const returnToMaker = () =>
    run(
      () => {
        assertCanCheck();
        return repos.admin
          .decideInterest(activeId, "Returned", {
            by: adminName,
            role: admin?.role,
            reason,
          })
          .then(() =>
            audit(
              "Returned interest to maker",
              `Interest ${activeId}`,
              reason,
              "Financial",
            ),
          );
      },
      () => {
        setReturnOpen(false);
        setReason("");
      },
      "Returned to maker.",
    );
  const notify = () => {
    const selectedChannels = (
      Object.keys(channels) as (keyof typeof channels)[]
    )
      .filter((key) => channels[key])
      .map((key) => NOTIFY_CHANNELS[key]);
    return run(
      () =>
        repos.admin.notifyInterest(
          activeId,
          selectedChannels,
          adminName,
        ),
      () => setStage(8),
      `Sent to ${w.eligible.toLocaleString()} members.`,
    );
  };

  // `wizard_stages` drives the stepper's labels and pending/current/completed
  // state; local navigation may still move the current marker forward.
  const wizardSteps = interestWizardSteps(w);
  const historyRows = interestHistory.length ? interestHistory : w.history;

  return (
    <>
      <AdminPageHeader
        title={`Interest · savings year ${w.year}`}
        sub={
          <span className="flex items-center gap-2">
            <Pill tone={STATUS_TONE[w.status]}>
              {w.statusLabel || w.status}
            </Pill>{" "}
            Maker: {w.maker ?? "Administrator"} · Checker: a different Super Admin
          </span>
        }
        back={paths.admin.interest}
      />
      <div className="flex flex-col gap-5 px-4 py-5 sm:px-8 sm:py-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-8">
          {wizardSteps.map((s) => {
            const n = s.step;
            const completed = s.status === "completed";
            const current =
              !completed && (s.status === "current" || n === stage);
            const viewing = n === stage;
            const openable = completed || current || (n === 7 && batchCreated);
            return (
              <button
                key={s.key || n}
                disabled={!openable}
                title={openable ? s.label : "Finish the earlier stages first"}
                onClick={() => goToStage(n)}
                className={`flex flex-col items-start gap-1.5 rounded-2xl p-2.5 text-left text-xs font-bold transition ${viewing ? "border-2 border-brand bg-[#faf7fe] text-ink" : current ? "border-[1.5px] border-brand bg-[#faf7fe] text-ink" : "border-[1.5px] border-line bg-white text-mute"} ${!openable ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-extrabold ${completed ? "bg-brand text-white" : current ? "bg-gold text-[#2a1a00]" : "bg-soft text-mute"}`}
                >
                  {completed ? <Check size={12} /> : n}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>

        {w.status === "Returned" && (
          <Banner tone="fail">Returned by the checker: {w.rejectReason}</Banner>
        )}

        {stage === 1 && (
          <Card className="flex w-full flex-col gap-4">
            <h2 className="text-base font-extrabold">Period setup</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField
                label="Savings start"
                type="date"
                value={config.savings_start}
                disabled={locked}
                onChange={(e) =>
                  setConfig({ ...config, savings_start: e.target.value })
                }
              />
              <TextField
                label="Savings end"
                type="date"
                value={config.savings_end}
                disabled={locked}
                onChange={(e) =>
                  setConfig({ ...config, savings_end: e.target.value })
                }
              />
              <TextField
                label="Contributions close"
                type="date"
                value={config.contribution_close}
                disabled={locked}
                onChange={(e) =>
                  setConfig({ ...config, contribution_close: e.target.value })
                }
              />
            </div>
            {!locked && !stepDone(1) && (
              <div>
                <Button size="md" disabled={busy} onClick={savePeriod}>
                  Save and continue
                </Button>
              </div>
            )}
          </Card>
        )}

        {stage === 2 && (
          <Card className="flex w-full flex-col gap-4">
            <h2 className="text-base font-extrabold">Rule configuration</h2>
            <div className="grid gap-4 md:grid-cols-3"></div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">Interest rate structure</span>
              <Chips<InterestRateMode>
                value={rateMode}
                options={[
                  { value: "Fixed rate", label: "Fixed rate for all members" },
                  {
                    value: "Contribution ranges",
                    label: "Rates by contribution range",
                  },
                ]}
                onChange={(v) => {
                  if (!locked) setRateMode(v);
                }}
              />
              <p className="text-sm font-semibold leading-relaxed text-mute">
                {rateMode === "Fixed rate"
                  ? "One rate applies to every eligible member, whatever they saved."
                  : "Choose a rate for each band of total contributions. A member gets the rate for the band their savings fall into."}
              </p>
            </div>
            {rateMode === "Fixed rate" ? (
              <TextField
                label="Interest rate (%)"
                inputMode="decimal"
                placeholder="e.g. 10"
                hint="2025 · 10%, 2024 · 9%"
                value={rate}
                disabled={locked}
                onChange={(e) => setRate(e.target.value)}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold">Contribution ranges</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={locked}
                    onClick={() =>
                      setBands((prev) => [
                        ...prev,
                        { min: "", max: "", rate: "" },
                      ])
                    }
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
                      onChange={(e) =>
                        setBands((prev) =>
                          prev.map((x, k) =>
                            k === i
                              ? { ...x, min: e.target.value.replace(/\D/g, "") }
                              : x,
                          ),
                        )
                      }
                    />
                    <TextField
                      label="To (₦)"
                      inputMode="numeric"
                      placeholder={
                        i === bands.length - 1 ? "No limit" : "e.g. 100,000"
                      }
                      value={b.max}
                      disabled={locked}
                      onChange={(e) =>
                        setBands((prev) =>
                          prev.map((x, k) =>
                            k === i
                              ? { ...x, max: e.target.value.replace(/\D/g, "") }
                              : x,
                          ),
                        )
                      }
                    />
                    <TextField
                      label="Rate (%)"
                      inputMode="decimal"
                      placeholder="e.g. 10"
                      value={b.rate}
                      disabled={locked}
                      onChange={(e) =>
                        setBands((prev) =>
                          prev.map((x, k) =>
                            k === i ? { ...x, rate: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={locked || bands.length === 1}
                      onClick={() =>
                        setBands((prev) =>
                          prev
                            .filter((_, k) => k !== i)
                            .map((x, k) =>
                              k === 0 ? { ...x, min: "10000" } : x,
                            ),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <p className="text-[13px] font-semibold leading-relaxed text-mute">
                  The first range always starts at ₦10,000. Leave the last “To”
                  blank for no upper limit.
                </p>
              </div>
            )}
            <SelectField
              label="Rounding"
              options={["Nearest naira", "Nearest kobo"]}
              value={rounding}
              disabled={locked}
              onChange={(e) => setRounding(e.target.value)}
            />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">Apply interest to</span>
              <Chips<InterestScope>
                value={scope}
                options={[
                  { value: "All members", label: "All members" },
                  {
                    value: "Selected members",
                    label: "Select members manually",
                  },
                ]}
                onChange={(v) => {
                  if (!locked) setScope(v);
                }}
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
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={locked}
                    onClick={openPicker}
                  >
                    {selectedIds.length === 0
                      ? "Choose members"
                      : "Edit selection"}
                  </Button>
                )}
                <button
                  onClick={() => setPreviewOpen((v) => !v)}
                  aria-expanded={previewOpen}
                  className="ml-auto inline-flex items-center gap-1 text-sm font-bold text-brand"
                >
                  {previewOpen ? "Hide preview" : "Preview"}
                  <ChevronDown
                    size={16}
                    className={cn("transition", previewOpen && "rotate-180")}
                  />
                </button>
              </div>
              {previewOpen && (
                <div className="overflow-hidden rounded-xl border border-line bg-white">
                  {membersBusy ? (
                    <p className="px-3.5 py-3 text-sm font-semibold text-mute">
                      Loading members…
                    </p>
                  ) : selectedMembers.length === 0 ? (
                    <p className="px-3.5 py-3 text-sm font-semibold text-mute">
                      {scope === "Selected members"
                        ? "No members selected yet."
                        : "No members available."}
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {selectedMembers.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 text-sm last:border-b-0"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f1dfb9] text-[11px] font-extrabold text-[#6e4a0c]">
                            {m.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <b className="truncate text-[13px]">{m.name}</b>
                            <span className="text-[11px] font-semibold text-mute">
                              {m.id}
                            </span>
                          </span>
                          <Pill
                            tone={m.eligibility === "Eligible" ? "ok" : "fail"}
                          >
                            {m.eligibility}
                          </Pill>
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
                        Restore removed members (
                        {(w.excludedMemberIds ?? []).length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <TextField label="Basis" value="Proportional to savings" readOnly />
            <p className="text-sm font-semibold leading-relaxed text-mute">
              A month that closes with nothing saved forfeits interest unless a
              Super Admin approves an exception.
            </p>
            <div className="flex flex-wrap gap-2">
              <OpenDecisionTag code="OD-11">
                Interest eligibility
              </OpenDecisionTag>
              <OpenDecisionTag code="OD-14">
                Interest calculation
              </OpenDecisionTag>
            </div>
            {!locked && !stepDone(2) && (
              <div>
                <Button size="md" disabled={busy} onClick={saveRules}>
                  Save and continue
                </Button>
              </div>
            )}
          </Card>
        )}

        {stage === 3 && (
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-2xl font-extrabold leading-tight">
                  3. Calculation
                </h3>
                {calculationDone && (
                  <span className="ml-auto flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Download size={18} />}
                      onClick={() => {
                        downloadCsv(
                          `iwh-interest-${w.year}-preview.csv`,
                          [
                            "Member ID",
                            "Name",
                            "Contributions",
                            "Interest",
                            "Eligibility",
                          ],
                          preview.map((row) => [
                            row.memberId,
                            row.memberName,
                            formatNaira(row.contributionsKobo),
                            formatNaira(row.interestKobo),
                            row.eligible
                              ? "Eligible"
                              : (row.reason ?? "Forfeited"),
                          ]),
                        );
                      }}
                      disabled={preview.length === 0}
                    >
                      Export
                    </Button>
                    {!locked && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<RefreshCw size={18} />}
                        onClick={calculate}
                        disabled={busy}
                      >
                        Recalculate
                      </Button>
                    )}
                  </span>
                )}
              </div>
              {!calculationDone ? (
                <div className="flex flex-col items-center gap-2 px-4 py-9 text-center text-mute">
                  {busy ? (
                    <>
                      <LoaderCircle
                        className="animate-spin text-brand"
                        size={28}
                      />
                      <b className="text-ink">
                        Calculating interest for{" "}
                        {(members.length || w.eligible).toLocaleString()}{" "}
                        members…
                      </b>
                    </>
                  ) : (
                    <>
                      <Percent size={28} className="text-mute" />
                      <b className="text-ink">
                        Ready to calculate at {w.rate ?? "—"}%
                      </b>
                      <span className="text-sm font-semibold">
                        Applies the rules to every member’s {w.year}{" "}
                        contributions.
                      </span>
                      {!locked && !stepDone(3) && (
                        <Button
                          size="md"
                          disabled={busy || !hasRates}
                          onClick={calculate}
                        >
                          Run calculation
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-2.5 md:grid-cols-4">
                    <Kpi
                      label="Eligible members"
                      value={w.eligible.toLocaleString()}
                    />
                    <Kpi
                      label="Forfeited"
                      value={w.forfeited.toLocaleString()}
                      tone="bad"
                    />
                    <Kpi
                      label="Eligible contributions"
                      value={
                        w.contributionsKobo
                          ? formatNaira(w.contributionsKobo)
                          : "—"
                      }
                    />
                    <Kpi
                      label="Total interest"
                      value={formatNaira(w.interestKobo)}
                      note={w.rate != null ? `At ${w.rate}%` : undefined}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-sm">Preview</b>
                    <label className="ml-auto flex h-9 w-full sm:w-60 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute">
                      <Search size={16} />
                      <input
                        className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                        placeholder="Search member"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                      />
                    </label>
                  </div>
                  {preview.length > 0 ? (
                    <>
                      <DataTable<InterestCalcRow>
                        rows={filtered}
                        rowKey={(r) => r.memberId}
                        columns={[
                          {
                            header: "Member",
                            render: (r) => (
                              <div>
                                <b>{r.memberName}</b>
                                <div className="mono text-xs text-mute">
                                  {r.memberId}
                                </div>
                              </div>
                            ),
                          },
                          {
                            header: "Contributions",
                            align: "right",
                            render: (r) => formatNaira(r.contributionsKobo),
                          },
                          {
                            header: "Share of pool",
                            align: "right",
                            render: (r) =>
                              r.sharePct != null
                                ? `${r.sharePct.toFixed(3)}%`
                                : "—",
                          },
                          {
                            header: "Interest",
                            align: "right",
                            render: (r) => <b>{formatNaira(r.interestKobo)}</b>,
                          },
                          {
                            header: "Eligibility",
                            render: (r) =>
                              r.eligible ? (
                                <Pill
                                  tone="ok"
                                  icon={<Shield size={12} strokeWidth={2.6} />}
                                >
                                  Eligible
                                </Pill>
                              ) : (
                                <Pill tone="fail">
                                  {r.reason ?? "Forfeited"}
                                </Pill>
                              ),
                          },
                        ]}
                      />
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-mute">
                      The calculation returned totals only. No member-level
                      breakdown was provided for this run.
                    </p>
                  )}
                  {!locked && !stepDone(3) && (
                    <div>
                      <Button size="md" onClick={() => setStage(4)}>
                        Save and continue
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>
        )}

        {stage === 4 && (
          <Card className="flex flex-col gap-4">
            <h2 className="text-base font-extrabold">Review and submit</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col">
                {[
                  ["Period", `${w.start} – ${w.end}`],
                  ["Rate", rateLabel(w)],
                  [
                    "Applies to",
                    w.scope === "Selected members"
                      ? `${w.selectedMemberIds.length} selected members`
                      : "All members",
                  ],
                  ["Eligible", w.eligible.toLocaleString()],
                  ["Forfeited", String(w.forfeited)],
                  ["Total interest", formatNaira(w.interestKobo)],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0"
                  >
                    <span className="font-semibold text-mute">{k}</span>
                    <b>{v}</b>
                  </div>
                ))}
                {w.rateMode === "Contribution ranges" && (
                  <div className="pt-3">
                    <BandSummary bands={w.bands ?? []} />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-bold">
                  Note for the checker (optional)
                  <textarea
                    rows={5}
                    value={note}
                    disabled={locked}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anything the checker should know"
                    className="w-full rounded-input border-[1.5px] border-line bg-white p-3.5 text-[15px] font-semibold outline-none focus:border-brand"
                  />
                </label>
              </div>
            </div>
            {stepDone(4) && !stepDone(5) ? (
              <Banner tone="info" icon={<Clock size={20} />}>
                Submitted by{" "}
                {w.submittedBy?.name ?? w.maker ?? "an administrator"} and
                awaiting approval.
              </Banner>
            ) : (
              !locked &&
              !stepDone(4) && (
                <div>
                  <Button
                    size="md"
                    disabled={busy || !calculationDone}
                    onClick={submit}
                  >
                    Submit for approval
                  </Button>
                </div>
              )
            )}
          </Card>
        )}

        {stage === 5 && (
          <Card className="flex w-full flex-col items-start gap-3">
            <h2 className="text-base font-extrabold">Approval</h2>
            {w.status === "Approved" ? (
              <Banner tone="info" icon={<Check size={20} />}>
                Approved by {w.checker ?? w.reviewedBy?.name ?? "the checker"}{" "}
                on {formatApprovalDate(w.approvedAt ?? w.reviewedAt)}.
              </Banner>
            ) : isMaker ? (
              <Banner tone="neutral">
                You prepared this request. Another Super Admin must approve or
                return it — makers cannot check their own work.
              </Banner>
            ) : !awaitingApproval ? (
              <p className="text-sm font-semibold text-mute">
                Submit the configuration for approval first (stage 4).
              </p>
            ) : canCheck && !stepDone(5) ? (
              <>
                <p className="text-sm font-semibold">
                  Rate {rateLabel(w)} · total interest{" "}
                  {formatNaira(w.interestKobo)} · {w.eligible.toLocaleString()}{" "}
                  eligible.
                </p>
                {w.rateMode === "Contribution ranges" && (
                  <BandSummary bands={w.bands ?? []} />
                )}
                {w.note && (
                  <p className="text-sm text-mute">Maker’s note: {w.note}</p>
                )}
                <div className="flex flex-wrap gap-2.5">
                  <Button size="md" onClick={() => setApproveOpen(true)}>
                    Approve configuration
                  </Button>
                  <Button
                    size="md"
                    variant="outline"
                    onClick={() => setReturnOpen(true)}
                  >
                    Return to maker
                  </Button>
                  <Button
                    size="md"
                    variant="outline"
                    onClick={() => setStage(3)}
                  >
                    Review calculation
                  </Button>
                </div>
              </>
            ) : (
              <Banner tone="neutral">
                Only a different Super Admin can approve.{" "}
                {isSuper ? "" : "Switch role from the header in demo mode."}
              </Banner>
            )}
          </Card>
        )}

        {stage === 6 && (
          <Card className="flex w-full flex-col items-start gap-3">
            <h2 className="text-base font-extrabold">Payout batch</h2>
            {!batchCreated ? (
              <>
                <p className="text-sm font-semibold leading-relaxed text-mute">
                  Create the year-end payout batch for December {w.year}. Each
                  member’s savings plus approved interest is listed for review.
                </p>
                {w.status === "Approved" && (
                  <Button
                    size="md"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          repos.admin.createInterestPayouts(activeId),
                        () => {
                          setPayoutBatchCreated(true);
                          setStage(7);
                        },
                        "Payout batch created.",
                      )
                    }
                  >
                    Create payout batch
                  </Button>
                )}
              </>
            ) : (
              <>
                <Banner tone="info" icon={<Check size={20} />}>
                  Payout batch <b>{payoutBatchId}</b> created and sent for
                  approval.
                </Banner>
                <ButtonLink to={payoutBatchPath} size="md">
                  Open payout batch
                </ButtonLink>
              </>
            )}
          </Card>
        )}

        {stage === 7 && (
          <Card className="flex w-full flex-col gap-3">
            <h2 className="text-base font-extrabold">Notify members</h2>
            <Card tone="soft">
              <p className="text-sm font-semibold leading-relaxed">
                Good news: your {w.year} interest has been approved. Eligible
                savers will receive interest with the December payout.
              </p>
            </Card>
            <div className="grid gap-2 md:grid-cols-2">
              {(Object.keys(channels) as (keyof typeof channels)[]).map((c) => (
                <Checkbox
                  key={c}
                  checked={channels[c]}
                  onChange={(v) => setChannels({ ...channels, [c]: v })}
                >
                  {c === "InApp" ? "In-app" : c}
                </Checkbox>
              ))}
            </div>
            {w.notified ? (
              <Banner tone="info" icon={<Check size={20} />}>
                Members have been notified.
              </Banner>
            ) : !stepDone(7) ? (
              <div>
                <Button size="md" disabled={busy} onClick={notify}>
                  Notify members
                </Button>
              </div>
            ) : null}
          </Card>
        )}

        {stage === 8 && (
          <Card className="flex w-full flex-col gap-2">
            <h2 className="text-base font-extrabold">History</h2>
            {historyLoading && interestHistory.length === 0 ? (
              <p className="text-sm font-semibold text-mute">
                Loading history…
              </p>
            ) : historyRows.length === 0 ? (
              <p className="text-sm font-semibold text-mute">No events yet.</p>
            ) : (
              historyRows.map(([at, ev, who], i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-line py-2.5 text-sm last:border-b-0"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand-dark">
                    <Check size={14} />
                  </span>
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="font-semibold">{historyAction(ev)}</span>
                    <span className="text-xs font-semibold text-mute">
                      {who}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-xs font-semibold text-mute">
                    {formatHistoryDate(at)}
                  </span>
                </div>
              ))
            )}
          </Card>
        )}
      </div>

      <Modal
        open={approveOpen}
        title="Approve configuration"
        onClose={() => setApproveOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={approve}>
              Approve
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="leading-relaxed text-[#474252]">
            This locks the interest rules ({rateLabel(w)}) for{" "}
            {w.eligible.toLocaleString()} eligible members (
            {formatNaira(w.interestKobo)} total interest).
          </p>
          {w.rateMode === "Contribution ranges" && (
            <BandSummary bands={w.bands ?? []} />
          )}
        </div>
      </Modal>

      <Modal
        open={returnOpen}
        title="Return to maker"
        onClose={() => setReturnOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim() || busy}
              onClick={returnToMaker}
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
        open={pickerOpen}
        title="Choose members for interest"
        wide
        onClose={() => setPickerOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={draftIds.length === 0}
              onClick={() => {
                setSelectedIds(draftIds);
                setPickerOpen(false);
              }}
            >
              Apply selection ({draftIds.length})
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 w-full items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute sm:w-64">
              <Search size={16} />
              <input
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                placeholder="Search member"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
              />
            </label>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraftIds((d) =>
                    Array.from(
                      new Set([...d, ...pickerFiltered.map((m) => m.id)]),
                    ),
                  )
                }
              >
                Select all shown
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraftIds([])}
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">Interest eligibility</span>
            <Chips<PickerEligibility>
              value={pickerEligibility}
              options={[
                { value: "All", label: `All members (${pickerCounts.All})` },
                {
                  value: "Eligible",
                  label: `Eligible (${pickerCounts.Eligible})`,
                },
                {
                  value: "Forfeited",
                  label: `Forfeited (${pickerCounts.Forfeited})`,
                },
              ]}
              onChange={setPickerEligibility}
            />
          </div>
          <p className="text-[13px] font-semibold text-mute">
            Showing {pickerFiltered.length.toLocaleString()} of{" "}
            {pickerMembers.length.toLocaleString()} members ·{" "}
            {draftIds.length.toLocaleString()} selected
          </p>
        </div>
        {pickerBusy ? (
          <p className="text-sm font-semibold text-mute">Loading members…</p>
        ) : pickerFiltered.length === 0 ? (
          <p className="text-sm font-semibold text-mute">
            No members match your search or eligibility filter.
          </p>
        ) : (
          <div className="flex flex-col">
            {pickerFiltered.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-3 border-b border-line py-2.5 text-sm last:border-b-0"
              >
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-brand"
                  checked={draftIds.includes(m.id)}
                  onChange={(e) =>
                    setDraftIds((d) =>
                      e.target.checked
                        ? [...d, m.id]
                        : d.filter((x) => x !== m.id),
                    )
                  }
                />
                <span className="flex-1">
                  <b>{m.name}</b> <span className="text-mute">{m.id}</span>
                </span>
                <Pill tone={m.eligibility === "Eligible" ? "ok" : "fail"}>
                  {m.eligibility}
                </Pill>
              </label>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
