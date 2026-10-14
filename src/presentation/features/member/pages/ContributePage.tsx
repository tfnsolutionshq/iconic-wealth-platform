import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, ChevronLeft, History, Star } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useContributionDraft } from "../../../contexts/ContributionDraftContext";
import { useSavings } from "../../../hooks/useSavings";
import {
  Banner,
  Button,
  Card,
  KeyValue,
  Pill,
  cn,
} from "../../../design-system";
import {
  MONTHS,
  daysUntil,
  deadlineFor,
  formatNaira,
  formatShortDate,
  isCatchUp,
  minimumFor,
  monthState,
  monthTotal,
  openMonth,
  parseNairaInput,
  planAllocation,
  targetFor,
} from "@/domain/rules";
import { paths } from "../../../routes/paths";

/** MEM-07 (v5): amount only. Minimum per payment; the payment goes to the oldest open month (catch-up months first). */
export function ContributePage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const draft = useContributionDraft();
  const member = session?.kind === "member" ? session.member : null;
  const { data } = useSavings(member);
  const [text, setText] = useState(
    draft.amount ? String(draft.amount / 100) : "",
  );
  const plan = useMemo(
    () =>
      data
        ? planAllocation(
            text
              ? parseNairaInput(text)
              : minimumFor(data.settings, data.year.year),
            data.year,
            data.txs,
            data.now,
            data.settings,
          )
        : null,
    [data, text],
  );
  if (!member || !data || !plan) return <p className="text-mute">Loading…</p>;
  const { year, txs, now, settings } = data;
  const i = openMonth(year, now, settings);
  const min = minimumFor(settings, year.year);
  if (i === null)
    return (
      <Card>
        <b>All {year.year} savings months are locked.</b>
      </Card>
    );
  const amount = text ? parseNairaInput(text) : min;
  const state = monthState(year, txs, i, now, settings);
  const total = monthTotal(year, txs, i);
  const target = targetFor(year, i);
  const catchUps = Array.from(
    { length: year.joinMonth ?? 0 },
    (_, k) => k,
  ).filter((k) => monthState(year, txs, k, now, settings) !== "saved");
  const clearAll = catchUps.reduce(
    (s, k) => s + min - monthTotal(year, txs, k),
    0,
  );
  const quick = [
    ...new Set(
      [
        min,
        catchUps.length > 1 ? clearAll : 0,
        !catchUps.length && target > total && target - total > min
          ? target - total
          : 0,
        min * 2,
        min * 3,
      ].filter((v) => v >= min),
    ),
  ];
  const label = (v: number) =>
    catchUps.length > 1 && v === clearAll
      ? "Clear all catch-up · "
      : !catchUps.length && target > total && v === target - total
        ? "Rest of target · "
        : "";
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
      {state === "catchup" ? (
        <Banner tone="warn" icon={<History size={20} />}>
          <b>Catch-up first.</b> You joined in {MONTHS[year.joinMonth!]}, so
          January–{MONTHS[year.joinMonth! - 1]} need {formatNaira(min)} each
          before {MONTHS[year.joinMonth!]} counts. Any extra goes to the next
          month.
        </Banner>
      ) : (
        <Card className="flex items-center gap-3">
          <span className="flex size-10.5 items-center justify-center rounded-input bg-soft">
            <Calendar size={20} />
          </span>
          <span className="flex flex-1 flex-col">
            <b>
              This payment goes to {MONTHS[i]} {year.year}
            </b>
            <span className="text-[13px] font-semibold text-mute">
              {state === "ahead"
                ? "Saving ahead"
                : `Closes ${formatShortDate(deadlineFor(year.year, i))} · ${daysUntil(now, deadlineFor(year.year, i))} days left`}{" "}
              · {formatNaira(total)} saved so far
            </span>
          </span>
          <Pill tone={state === "ahead" ? "info" : "ok"}>
            {state === "ahead" ? "Ahead" : "Open"}
          </Pill>
        </Card>
      )}
      <div>
        <label htmlFor="amount" className="mb-2 block text-sm font-bold">
          Amount
        </label>
        <div
          className={cn(
            "flex h-18 items-center gap-2 rounded-2xl border-2 bg-white px-4 text-3xl font-extrabold",
            plan.ok ? "border-brand" : "border-fail",
          )}
        >
          <span className="text-mute">₦</span>
          <input
            id="amount"
            inputMode="numeric"
            className="w-full bg-transparent outline-none"
            value={(amount / 100).toLocaleString("en-NG")}
            onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        {plan.ok ? (
          <p className="mt-1.5 text-[13px] font-semibold text-mute">
            Minimum {formatNaira(min)} per payment. Pay as often as you like.
          </p>
        ) : (
          <p className="mt-1.5 text-[13px] font-bold text-fail">{plan.error}</p>
        )}
        {plan.ok &&
          !isCatchUp(year, i) &&
          target > 0 &&
          (total + amount >= target ? (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] font-extrabold text-ok">
              <Star size={14} />
              This payment meets your {MONTHS[i]} target of{" "}
              {formatNaira(target)}.
            </p>
          ) : (
            <p className="mt-1 text-[13px] font-semibold text-mute">
              After this payment: {formatNaira(total + amount)} of your{" "}
              {formatNaira(target)} target.
            </p>
          ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {quick.map((v) => (
          <Button
            key={v}
            size="sm"
            variant={amount === v ? "dark" : "outline"}
            onClick={() => setText(String(v / 100))}
          >
            {label(v)}
            {formatNaira(v)}
          </Button>
        ))}
      </div>
      {plan.ok && plan.allocations.length > 1 && (
        <Card>
          <span className="text-[13px] font-bold text-mute">
            How this payment is applied
          </span>
          {plan.allocations.map((a) => (
            <KeyValue
              key={a.month}
              label={`${MONTHS[a.month]}${isCatchUp(year, a.month) ? " (catch-up)" : ""}`}
              value={formatNaira(a.amountKobo)}
            />
          ))}
        </Card>
      )}
      <Button
        full
        disabled={!plan.ok}
        onClick={() => {
          draft.setAmount(amount);
          navigate(paths.member.review);
        }}
      >
        Review payment
      </Button>
    </div>
  );
}
