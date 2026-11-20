import { useCallback, useEffect, useState } from "react";
import type {
  Kobo,
  Member,
  MonthIndex,
  SavingsDashboard,
  SavingsMonth,
  SavingsPeriod,
  Transaction,
} from "@/domain/entities";
import { MONTHS, deadlineFor } from "@/domain/rules";
import { useServices } from "../contexts/ServicesContext";

export interface SavingsViewState {
  /** 1-based month (2..11) when the member joined mid-year; months 1..(joinMonth-1) are catch-up months. */
  joinMonth: number | null;
  joinMonthName: string | null;
  lastCatchUpMonthName: string | null;
  /** Returns true when the given 1-based month (1..11) is a catch-up month. */
  isMonthCatchUp: (month1Based: number) => boolean;
  /** Returns true when the given 1-based month (1..11) has been paid/saved (ticked off with ✓). */
  isMonthSaved: (month1Based: number) => boolean;
  /** Returns the known saved amount in kobo for a 1-based month. */
  monthSavedAmount: (month1Based: number) => Kobo;
  /** Returns all confirmed contribution transactions for a 1-based month (newest first). */
  monthPayments: (month1Based: number) => Transaction[];
  /** Returns the backend savings_month UUID for a 1-based month (used by POST /savings/months/{id}/lock). */
  monthSavingsId: (month1Based: number) => string | null;
  /** 1-based month numbers (1..11) that are catch-up months and not yet cleared. */
  catchUpMonthsLeft: number[];
  /** True ONLY while there is at least one uncleared catch-up month left. */
  isCatchUpMode: boolean;
  /** 1-based month number of the current catch-up month being paid, when in catch-up mode. */
  activeCatchUpMonth: number | null;
  activeCatchUpMonthName: string | null;
  /** The active normal open period once all catch-up months are cleared (e.g. November). */
  openPeriod: SavingsPeriod | null;
}

export interface SavingsDashboardData {
  /** The signed-in member's dashboard from GET /savings. */
  dashboard: SavingsDashboard;
  /** The status of every savings month for the dashboard's year. */
  months: SavingsMonth[];
  /** The three most recent transactions, best-effort: an empty list when unavailable. */
  recent: Transaction[];
  now: Date;
  viewState: SavingsViewState;
}

const PAID_STATUS_SET = new Set(["saved", "completed", "paid", "cleared"]);
const DEFAULTED_STATUS_SET = new Set(["defaulted", "missed"]);

function hasCatchKeyword(value?: string | null): boolean {
  return Boolean(value && value.toLowerCase().includes("catch"));
}

function readRawCreatedAtMonth(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("iwh.user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { created_at?: string | null } | null;
    const createdAt = parsed?.created_at;
    if (createdAt && /^\d{4}-\d{2}/.test(createdAt)) {
      const y = Number(createdAt.slice(0, 4));
      const m = Number(createdAt.slice(5, 7));
      if (y >= 2025 && m >= 1 && m <= 12) return m;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function parseOpenMonthFromJourney(dashboard: SavingsDashboard): number | null {
  const desc = dashboard.payoutJourney?.steps?.[0]?.description ?? "";
  for (let i = 0; i < 11; i++) {
    if (new RegExp(`\\b${MONTHS[i]}\\s+open\\b`, "i").test(desc)) {
      return i + 1;
    }
  }
  return null;
}

export function deriveSavingsViewState(
  member: Member | null,
  dashboard: SavingsDashboard,
  months: SavingsMonth[],
  transactions: Transaction[],
  now: Date,
): SavingsViewState {
  const { summary, activeMonth, nextPeriod, settings } = dashboard;
  const minimum = settings.minimumPerPayment;
  const year = activeMonth?.year ?? nextPeriod?.year ?? summary.year;

  const minimumNet = Math.max(
    0,
    minimum - (settings.platformChargePerPayment ?? 0),
  );

  // Confirmed contributions from GET /savings/contributions
  const confirmedTxs = transactions
    .filter(
      (tx) =>
        tx.kind === "Contribution" &&
        tx.status === "Successful" &&
        tx.amountKobo >= minimumNet,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const txSavedByMonth = new Map<number, Kobo>();
  const txsByMonth = new Map<number, Transaction[]>();
  const txMonthIdByMonth = new Map<number, string>();
  const txMonthStatusByMonth = new Map<number, string>();

  for (const tx of confirmedTxs) {
    for (const alloc of tx.allocations) {
      const mNum = alloc.month + 1;
      txSavedByMonth.set(
        mNum,
        (txSavedByMonth.get(mNum) ?? 0) + alloc.amountKobo,
      );
      const list = txsByMonth.get(mNum) ?? [];
      list.push(tx);
      txsByMonth.set(mNum, list);
      if (tx.savingsMonth?.id && !txMonthIdByMonth.has(mNum)) {
        txMonthIdByMonth.set(mNum, tx.savingsMonth.id);
      }
      if (tx.savingsMonth?.status && !txMonthStatusByMonth.has(mNum)) {
        txMonthStatusByMonth.set(mNum, tx.savingsMonth.status.toLowerCase());
      }
    }
  }

  const backendCatchUpPeriod =
    (nextPeriod?.isCatchUp ? nextPeriod : null) ??
    (activeMonth?.isCatchUp ? activeMonth : null) ??
    (dashboard.isCatchUp ? (nextPeriod ?? activeMonth) : null);

  const hasAnyCatchSignal = Boolean(
    dashboard.isCatchUp ||
      backendCatchUpPeriod ||
      months.some(
        (m) =>
          m.isCatchUp ||
          hasCatchKeyword(m.status) ||
          hasCatchKeyword(m.statusLabel),
      ),
  );

  // Determine the member's join / current open month (2..11, e.g. 11 for November so Jan–Oct are catch-up months)
  const explicitCatchMonths = months
    .filter(
      (m) =>
        m.isCatchUp ||
        hasCatchKeyword(m.status) ||
        hasCatchKeyword(m.statusLabel),
    )
    .map((m) => m.month);

  const journeyOpenMonth = parseOpenMonthFromJourney(dashboard);
  const createdAtMonth = readRawCreatedAtMonth();
  let memberJoinMonth: number | null = createdAtMonth;
  if (
    memberJoinMonth === null &&
    member?.joinedOn &&
    member.joinedOn !== member.dateOfBirth &&
    /^\d{4}-\d{2}/.test(member.joinedOn)
  ) {
    const y = Number(member.joinedOn.slice(0, 4));
    const m = Number(member.joinedOn.slice(5, 7));
    if (y >= 2025 && m >= 1 && m <= 12) {
      memberJoinMonth = m;
    }
  }
  const calMonth = Math.min(now.getMonth() + 1, 11);

  let joinMonth: number | null = null;
  if (explicitCatchMonths.length > 1) {
    const maxCatch = Math.max(...explicitCatchMonths);
    joinMonth = Math.min(11, maxCatch + 1);
  } else if (hasAnyCatchSignal) {
    const resolved =
      journeyOpenMonth ??
      (memberJoinMonth ? Math.min(memberJoinMonth, 11) : null) ??
      calMonth;
    joinMonth = Math.max(2, Math.min(11, resolved));
  } else if (memberJoinMonth !== null && memberJoinMonth >= 2) {
    joinMonth = Math.min(memberJoinMonth, 11);
  } else if (activeMonth && activeMonth.month < calMonth) {
    joinMonth = calMonth;
  }

  const maxCatchUpMonths = joinMonth !== null ? Math.max(0, joinMonth - 1) : 0;

  // Check how many catch-up months (1 .. joinMonth - 1) have been paid across all sources
  const explicitPaidCatchMonths = months.filter(
    (m) =>
      m.month <= maxCatchUpMonths &&
      (m.savedAmount >= minimumNet ||
        (PAID_STATUS_SET.has(m.status.toLowerCase()) && m.savedAmount > 0)),
  ).length;

  const fromBackendPointer = backendCatchUpPeriod
    ? Math.max(0, backendCatchUpPeriod.month - 1)
    : activeMonth && activeMonth.month <= maxCatchUpMonths
      ? Math.max(0, activeMonth.month - 1)
      : 0;

  const fromTxCount = confirmedTxs.length;
  const fromSummaryMonths = summary.totalMonths;

  const clearedCatchUpCount =
    maxCatchUpMonths > 0
      ? Math.min(
          maxCatchUpMonths,
          Math.max(
            explicitPaidCatchMonths,
            fromBackendPointer,
            fromTxCount,
            fromSummaryMonths,
          ),
        )
      : 0;

  const isMonthCatchUp = (month1Based: number): boolean => {
    if (month1Based < 1 || month1Based > 11) return false;
    const m = months.find((item) => item.month === month1Based);
    if (
      m &&
      (m.isCatchUp ||
        hasCatchKeyword(m.status) ||
        hasCatchKeyword(m.statusLabel))
    ) {
      return true;
    }
    return joinMonth !== null && month1Based < joinMonth;
  };

  const isMonthSaved = (month1Based: number): boolean => {
    if (month1Based < 1 || month1Based > 11) return false;
    const m = months.find((item) => item.month === month1Based);
    const isAct = activeMonth?.month === month1Based;
    const statusLower = (m?.status ?? "").toLowerCase();

    // Direct check if this specific month has confirmed savings in months[] or transactions
    const directSavedAmt = Math.max(
      m?.savedAmount ?? 0,
      isAct ? (activeMonth?.savedAmount ?? 0) : 0,
      txSavedByMonth.get(month1Based) ?? 0,
    );

    if (isMonthCatchUp(month1Based)) {
      if (directSavedAmt >= minimumNet) return true;
      if (PAID_STATUS_SET.has(statusLower) && directSavedAmt > 0) return true;
      return month1Based <= clearedCatchUpCount;
    }

    // Normal month (joinMonth .. 11)
    if (DEFAULTED_STATUS_SET.has(statusLower)) return false;
    if (PAID_STATUS_SET.has(statusLower) && directSavedAmt > 0) {
      return true;
    }
    if (directSavedAmt >= minimumNet) return true;
    if (
      summary.totalMonths >= month1Based &&
      clearedCatchUpCount >= maxCatchUpMonths
    ) {
      return true;
    }

    return false;
  };

  const monthSavedAmount = (month1Based: number): Kobo => {
    const m = months.find((item) => item.month === month1Based);
    const isAct = activeMonth?.month === month1Based;
    const fromMonths = m?.savedAmount ?? 0;
    const fromActive = isAct ? (activeMonth?.savedAmount ?? 0) : 0;
    const fromTx = txSavedByMonth.get(month1Based) ?? 0;
    // Prefer the backend's authoritative saved_amount from GET /savings/months or GET /savings,
    // falling back to the sum of net_amount from GET /savings/contributions.
    const direct =
      fromMonths > 0
        ? fromMonths
        : fromActive > 0
          ? fromActive
          : fromTx;

    if (isMonthCatchUp(month1Based)) {
      if (isMonthSaved(month1Based)) {
        return direct > 0 ? direct : minimum;
      }
      return 0;
    }

    return direct;
  };

  const monthPayments = (month1Based: number): Transaction[] => {
    return txsByMonth.get(month1Based) ?? [];
  };

  const monthSavingsId = (month1Based: number): string | null => {
    const fromTx = txMonthIdByMonth.get(month1Based);
    if (fromTx) return fromTx;
    const m = months.find((item) => item.month === month1Based);
    if (m?.id) return m.id;
    if (activeMonth?.month === month1Based && activeMonth.id) {
      return activeMonth.id;
    }
    if (nextPeriod?.month === month1Based && nextPeriod.id) {
      return nextPeriod.id;
    }
    return null;
  };

  // Remaining unpaid catch-up months in order (e.g. [1, 2, ... 10], or [] when all 10 are paid!)
  const catchUpMonthsLeft = Array.from({ length: 11 }, (_, i) => i + 1).filter(
    (mNum) => isMonthCatchUp(mNum) && !isMonthSaved(mNum),
  );

  // A member is in catch-up mode ONLY while they still have at least 1 unpaid catch-up month left.
  // Once all catch-up months (e.g. Jan–Oct) are paid, catchUpMonthsLeft is empty and isCatchUpMode is false!
  const isCatchUpMode = catchUpMonthsLeft.length > 0;

  // Always pick the first UNPAID catch-up month (never a month that is already saved!)
  const activeCatchUpMonth = isCatchUpMode ? catchUpMonthsLeft[0] : null;

  const activeCatchUpMonthName =
    activeCatchUpMonth !== null
      ? (MONTHS[activeCatchUpMonth - 1] ?? null)
      : null;

  // Resolve the active normal open period when all catch-ups are cleared
  let openPeriod: SavingsPeriod | null = null;
  if (!isCatchUpMode) {
    if (activeMonth && !isMonthCatchUp(activeMonth.month)) {
      openPeriod = {
        ...activeMonth,
        id: activeMonth.id ?? monthSavingsId(activeMonth.month),
        savedAmount:
          monthSavedAmount(activeMonth.month) || activeMonth.savedAmount,
      };
    } else if (nextPeriod && !isMonthCatchUp(nextPeriod.month)) {
      openPeriod = {
        ...nextPeriod,
        id: nextPeriod.id ?? monthSavingsId(nextPeriod.month),
        savedAmount:
          monthSavedAmount(nextPeriod.month) || nextPeriod.savedAmount,
      };
    } else {
      const startOpenMonthNum =
        joinMonth ?? journeyOpenMonth ?? Math.min(now.getMonth() + 1, 11);
      for (let mNum = startOpenMonthNum; mNum <= 11; mNum++) {
        const mRecord = months.find((item) => item.month === mNum);
        const statusLower = (
          mRecord?.status ||
          txMonthStatusByMonth.get(mNum) ||
          ""
        ).toLowerCase();
        const isLockedByMember =
          statusLower === "locked" || statusLower === "closed";
        if (!isLockedByMember) {
          openPeriod = {
            id: monthSavingsId(mNum),
            year,
            month: mNum,
            period: `${year}-${String(mNum).padStart(2, "0")}`,
            monthName: MONTHS[mNum - 1],
            deadline:
              mRecord?.deadline ||
              deadlineFor(year, (mNum - 1) as MonthIndex).toISOString(),
            targetAmount:
              mRecord?.targetAmount ?? activeMonth?.targetAmount ?? null,
            savedAmount: monthSavedAmount(mNum),
            remainingAmount: mRecord?.remainingAmount ?? 0,
            progressPercentage: mRecord?.progressPercentage ?? null,
            targetMet: mRecord?.targetMet ?? false,
            status: "open",
            statusLabel: "Open",
            closeNote: mRecord?.closeNote ?? "",
            contributionsCount:
              monthPayments(mNum).length || (mRecord?.contributionsCount ?? 0),
          };
          break;
        }
      }
    }
  }

  return {
    joinMonth,
    joinMonthName: joinMonth ? (MONTHS[joinMonth - 1] ?? null) : null,
    lastCatchUpMonthName:
      joinMonth && joinMonth > 1 ? (MONTHS[joinMonth - 2] ?? null) : null,
    isMonthCatchUp,
    isMonthSaved,
    monthSavedAmount,
    monthPayments,
    monthSavingsId,
    catchUpMonthsLeft,
    isCatchUpMode,
    activeCatchUpMonth,
    activeCatchUpMonthName,
    openPeriod,
  };
}

const dashboardCache = new Map<string, SavingsDashboardData>();

/** Clears all cached dashboard snapshots (call on login/logout so accounts never bleed). */
export function clearSavingsDashboardCache() {
  dashboardCache.clear();
}

/**
 * Loads the member dashboard from GET /savings. Recent transactions are loaded
 * separately and never fail the dashboard: the live savings endpoint is the
 * source of truth for the summary.
 */
export function useSavingsDashboard(member: Member | null) {
  const { repos, clock } = useServices();
  const memberId = member?.id ?? null;
  const [state, setState] = useState<{
    memberId: string | null;
    data: SavingsDashboardData | null;
  }>(() => ({
    memberId,
    data: memberId ? (dashboardCache.get(memberId) ?? null) : null,
  }));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    memberId !== null && !dashboardCache.has(memberId),
  );

  // Immediately clear/swap data if the signed-in member changes without a page refresh
  const data =
    state.memberId === memberId
      ? state.data
      : memberId
        ? (dashboardCache.get(memberId) ?? null)
        : null;

  useEffect(() => {
    if (state.memberId !== memberId) {
      setState({
        memberId,
        data: memberId ? (dashboardCache.get(memberId) ?? null) : null,
      });
      setError(null);
    }
  }, [memberId, state.memberId]);

  const reload = useCallback(async () => {
    if (!member) return;
    if (!dashboardCache.has(member.id)) {
      setLoading(true);
    }
    setError(null);
    try {
      const dashboard = await repos.savingsDashboard.get(member.id);
      const monthsYear =
        dashboard.activeMonth?.year ??
        dashboard.nextPeriod?.year ??
        dashboard.summary.year;
      const [transactions, months] = await Promise.all([
        repos.member
          .listTransactions(member.id)
          .catch(() => [] as Transaction[]),
        repos.savingsDashboard
          .getMonths(monthsYear)
          .catch(() => [] as SavingsMonth[]),
      ]);
      const now = clock.now();
      const recent = [...transactions]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 3);
      const viewState = deriveSavingsViewState(
        member,
        dashboard,
        months,
        transactions,
        now,
      );
      const nextData = { dashboard, months, recent, now, viewState };
      dashboardCache.set(member.id, nextData);
      setState({ memberId: member.id, data: nextData });
    } catch (e) {
      setError((e as Error).message || "We couldn’t load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [repos, clock, member]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
