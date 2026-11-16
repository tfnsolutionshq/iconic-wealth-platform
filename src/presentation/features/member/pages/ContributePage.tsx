import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronLeft,
  Clock,
  History,
  Star,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useContributionDraft } from "../../../contexts/ContributionDraftContext";
import { useSavingsDashboard } from "../../../hooks/useSavingsDashboard";
import {
  Banner,
  Button,
  Card,
  LoadingScreen,
  Modal,
  Pill,
  cn,
} from "../../../design-system";
import {
  DEFAULT_SETTINGS,
  MONTHS,
  formatNaira,
  formatShortDate,
  parseNairaInput,
} from "@/domain/rules";
import { paths } from "../../../routes/paths";

const DEFAULT_MIN = DEFAULT_SETTINGS.minimumByYear[2026] ?? 10_000_00;

function parseDate(value: string): Date {
  return value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
}

export function ContributePage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const draft = useContributionDraft();
  const member = session?.kind === "member" ? session.member : null;
  const { data } = useSavingsDashboard(member);
  const [howOpen, setHowOpen] = useState(false);

  const now = data?.now ?? new Date();
  const dashboard = data?.dashboard;
  const viewState = data?.viewState;
  const minimum = dashboard?.settings.minimumPerPayment ?? DEFAULT_MIN;

  const isCatchUpMode = viewState?.isCatchUpMode ?? false;
  const joinMonthName = viewState?.joinMonthName ?? null;
  const lastCatchUpMonthName = viewState?.lastCatchUpMonthName ?? null;

  const activeMonth = viewState?.openPeriod ?? dashboard?.activeMonth ?? null;
  const nextPeriod = dashboard?.nextPeriod ?? null;
  const activeMonthName =
    (isCatchUpMode ? viewState?.activeCatchUpMonthName : null) ??
    activeMonth?.monthName ??
    nextPeriod?.monthName ??
    MONTHS[Math.min(now.getMonth(), 10)];
  const activeYear =
    activeMonth?.year ??
    nextPeriod?.year ??
    dashboard?.summary.year ??
    now.getFullYear();

  const savedSoFar = activeMonth?.savedAmount ?? 0;
  const target = !isCatchUpMode ? (activeMonth?.targetAmount ?? null) : null;
  const restOfTarget =
    target && target > savedSoFar && target - savedSoFar >= minimum
      ? target - savedSoFar
      : null;

  const defaultSuggested = draft.amount
    ? draft.amount
    : !isCatchUpMode && restOfTarget
      ? restOfTarget
      : minimum;

  const [text, setText] = useState<string | null>(
    draft.amount ? String(draft.amount / 100) : null,
  );

  const amount =
    text !== null ? (text ? parseNairaInput(text) : 0) : defaultSuggested;
  const isValid = amount >= minimum;
  const error = !isValid
    ? `The minimum per payment is ${formatNaira(minimum)}.`
    : null;

  const quick = (
    isCatchUpMode
      ? [minimum, minimum * 2, minimum * 4]
      : [minimum, restOfTarget, minimum * 2, minimum * 3]
  ).filter(
    (v, idx, arr): v is number =>
      v !== null && v >= minimum && arr.indexOf(v) === idx,
  );

  const activeDeadlineDate = activeMonth
    ? parseDate(activeMonth.deadline)
    : null;
  const daysLeft = activeDeadlineDate
    ? Math.max(
        0,
        Math.ceil((activeDeadlineDate.getTime() - now.getTime()) / 86_400_000),
      )
    : null;

  if (!member) {
    return <p className="text-mute">Please log in to make a contribution.</p>;
  }

  if (!data) {
    return (
      <div className="mx-auto flex max-w-140 flex-col gap-4">
        <div className="flex h-13 items-center gap-3">
          <Link
            to={paths.member.home}
            aria-label="Back"
            className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line bg-white"
          >
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-[19px] font-extrabold">Contribute</h1>
        </div>
        <LoadingScreen />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-140 flex-col gap-4">
      <div className="flex h-13 items-center gap-3">
        <Link
          to={paths.member.home}
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line bg-white"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-[19px] font-extrabold">Contribute</h1>
      </div>

      {isCatchUpMode ? (
        <Banner tone="warn" icon={<History size={20} />}>
          <b>Catch-up first.</b>{" "}
          {joinMonthName && lastCatchUpMonthName ? (
            <>
              You joined in {joinMonthName}, so January–{lastCatchUpMonthName}{" "}
              need at least {formatNaira(minimum)} each before {joinMonthName}{" "}
              savings count. Each one-time payment clears{" "}
              <b>{activeMonthName}</b> and moves you to the next month.
            </>
          ) : (
            <>
              You are paying catch-up for{" "}
              <b>
                {activeMonthName} {activeYear}
              </b>
              . Make a one-time payment of at least {formatNaira(minimum)} to
              clear {activeMonthName} and move to the next month.
            </>
          )}
        </Banner>
      ) : (
        <Card tone="soft" className="flex flex-wrap items-center gap-3 bg-soft">
          <span className="flex size-10.5 shrink-0 items-center justify-center rounded-input bg-white">
            <Calendar size={20} />
          </span>
          <span className="flex min-w-0 flex-1 basis-40 flex-col">
            <b>
              This payment goes to {activeMonthName} {activeYear}
            </b>
            <span className="text-[13px] font-semibold text-mute">
              {activeDeadlineDate ? (
                <>
                  Closes {formatShortDate(activeDeadlineDate)}
                  {daysLeft !== null
                    ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
                    : ""}{" "}
                  · {formatNaira(savedSoFar)} saved so far
                </>
              ) : (
                `Minimum ${formatNaira(minimum)} per payment`
              )}
            </span>
          </span>
          <Pill tone="ok" icon={<Clock size={12} />}>
            Open
          </Pill>
        </Card>
      )}

      <div>
        <label htmlFor="amount" className="mb-2 block text-sm font-bold">
          Amount
        </label>
        <div
          className={cn(
            "flex min-h-18 items-center gap-2 rounded-2xl border-2 bg-white px-4 py-2 text-2xl font-extrabold sm:text-3xl",
            isValid ? "border-brand" : "border-fail",
          )}
        >
          <span className="shrink-0 text-mute">₦</span>
          <input
            id="amount"
            inputMode="numeric"
            className="w-full min-w-0 bg-transparent tabular-nums outline-none"
            value={amount ? (amount / 100).toLocaleString("en-NG") : ""}
            onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        {isValid ? (
          <p className="mt-1.5 text-[13px] font-semibold text-mute">
            Minimum {formatNaira(minimum)} per payment. Pay as often as you
            like.
          </p>
        ) : (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold text-fail">
            <TriangleAlert size={15} />
            {error}
          </p>
        )}
        {isValid && !isCatchUpMode && target && target > 0 ? (
          savedSoFar + amount >= target ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-extrabold text-ok">
              <Star size={14} />
              <span>
                This payment meets your {activeMonthName} target of{" "}
                {formatNaira(target)}.
              </span>
            </div>
          ) : (
            <p className="mt-1 text-[13px] font-semibold text-mute">
              After this payment: {formatNaira(savedSoFar + amount)} of your{" "}
              {formatNaira(target)} target.
            </p>
          )
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {quick.map((v) => {
          const isRest = !isCatchUpMode && restOfTarget === v;
          return (
            <Button
              key={v}
              size="sm"
              variant={amount === v ? "dark" : "outline"}
              onClick={() => setText(String(v / 100))}
            >
              {isRest ? `Rest of target · ${formatNaira(v)}` : formatNaira(v)}
            </Button>
          );
        })}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setHowOpen(true)}
          className="text-sm font-bold text-brand hover:underline"
        >
          How do months close?
        </button>
      </div>

      <Button
        full
        disabled={!isValid}
        onClick={() => {
          draft.setAmount(amount);
          navigate(paths.member.review);
        }}
      >
        Review payment
      </Button>

      <Modal
        open={howOpen}
        title="How months close"
        onClose={() => setHowOpen(false)}
        footer={
          <Button full onClick={() => setHowOpen(false)}>
            Got it
          </Button>
        }
      >
        <div className="flex flex-col gap-2.5 leading-relaxed text-[#474252]">
          <p>
            Each savings month opens on the 1st. Pay as many times as you like;
            every payment of at least {formatNaira(minimum)} is added to the
            open month.
          </p>
          <p>
            A month closes automatically at the end of the 5th of the next
            month
            {activeDeadlineDate && !isCatchUpMode
              ? ` (${activeMonthName} closes ${formatShortDate(activeDeadlineDate)})`
              : ""}
            . Once a normal savings month has {formatNaira(minimum)} or more,
            you can also <b>lock</b> it early so your next payments count toward
            the following month.
          </p>
          <p>
            If a month closes with nothing saved, it’s recorded as missed and
            your interest for {activeYear} may be affected. Your savings are
            always safe.
          </p>
        </div>
      </Modal>
    </div>
  );
}
