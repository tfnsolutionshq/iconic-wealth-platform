import { useState } from "react";
import { Calendar, Check, History, Lock, Star, X } from "lucide-react";
import type { SavingsYear, Transaction } from "@/domain/entities";
import {
  MONTHS,
  canLock,
  daysUntil,
  deadlineFor,
  formatNaira,
  formatShortDate,
  isCatchUp,
  minimumFor,
  monthState,
  monthTotal,
  naira,
  openMonth,
  parseNairaInput,
  targetFor,
  targetHistory,
  targetStreak,
  validateTarget,
  type PlatformSettings,
} from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Modal,
  Pill,
  TextField,
} from "../../../design-system";
import { paths } from "../../../routes/paths";

interface Props {
  memberId: string;
  year: SavingsYear;
  txs: Transaction[];
  now: Date;
  settings: PlatformSettings;
  onChange: () => void;
}

/** The month payments currently go to, with Pay now and Lock (lock needs at least the minimum). */
export function OpenMonthCard({
  memberId,
  year,
  txs,
  now,
  settings,
  onChange,
}: Props) {
  const { repos } = useServices();
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const i = openMonth(year, now, settings);
  const min = minimumFor(settings, year.year);
  if (i === null)
    return (
      <Card>
        <b>All {year.year} savings months are locked</b>
        <p className="text-sm text-mute">
          Your savings are paid out in December.
        </p>
      </Card>
    );
  const state = monthState(year, txs, i, now, settings);
  const total = monthTotal(year, txs, i);
  const first = !txs.some(
    (t) => t.status === "Successful" && t.kind === "Contribution",
  );
  if (state === "catchup") {
    const left = Array.from(
      { length: year.joinMonth ?? 0 },
      (_, k) => k,
    ).filter((k) => monthState(year, txs, k, now, settings) !== "saved");
    return (
    <Card className="flex flex-col gap-3 border-2 border-gold bg-[#fffbf2]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10.5 shrink-0 items-center justify-center rounded-input bg-gold-tint text-[#7a5410]">
          <History size={20} />
        </span>
        <span className="flex min-w-0 flex-1 basis-40 flex-col">
            <b>Catch-up: {MONTHS[i]}</b>
            <span className="text-[13px] font-semibold text-mute">
              You joined in {MONTHS[year.joinMonth!]}. Clear {left.length}{" "}
              catch-up month{left.length > 1 ? "s" : ""} ({formatNaira(min)}{" "}
              each) first.
            </span>
          </span>
        </div>
        <ButtonLink to={paths.member.contribute} full>
          Pay catch-up
        </ButtonLink>
      </Card>
    );
  }
  const ahead = state === "ahead";
  const lockable = canLock(year, txs, i, now, settings);
  return (
    <Card className="flex flex-col gap-3 border-2 border-gold bg-[#fffbf2]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10.5 shrink-0 items-center justify-center rounded-input bg-gold-tint text-[#7a5410]">
          <Calendar size={20} />
        </span>
        <span className="flex min-w-0 flex-1 basis-40 flex-col">
          <b>
            {ahead
              ? `Saving ahead: ${MONTHS[i]} ${year.year}`
              : `${MONTHS[i]} is open`}
          </b>
          <span className="text-[13px] font-semibold text-mute">
            {ahead
              ? "Payments now count toward it."
              : `Closes ${formatShortDate(deadlineFor(year.year, i))} · ${daysUntil(now, deadlineFor(year.year, i))} days left`}
          </span>
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="font-semibold text-mute">Saved for {MONTHS[i]}</span>
        <b>{formatNaira(total)}</b>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <ButtonLink to={paths.member.contribute} className="min-w-0 flex-1">
          {first ? "Make your first payment" : "Pay now"}
        </ButtonLink>
        {!first && (
          <Button
            variant="outline"
            icon={<Lock size={18} />}
            disabled={!lockable}
            title={
              lockable
                ? undefined
                : `Lock once ${MONTHS[i]} has at least ${formatNaira(min)}`
            }
            onClick={() => setAsk(true)}
          >
            Lock
          </Button>
        )}
      </div>
      <Modal
        open={ask}
        title={`Lock ${MONTHS[i]}?`}
        onClose={() => setAsk(false)}
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setAsk(false)}>
              Not now
            </Button>
            <Button
              size="md"
              icon={<Lock size={18} />}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await repos.member.lockMonth(memberId, year.year, i);
                  toast(
                    `${MONTHS[i]} locked. Next payments count toward ${MONTHS[i + 1] ?? "January"}.`,
                  );
                  setAsk(false);
                  onChange();
                } catch (e) {
                  toast((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Lock {MONTHS[i]}
            </Button>
          </>
        }
      >
        <p className="leading-relaxed text-[#474252]">
          {MONTHS[i]} will be saved at <b>{formatNaira(total)}</b> and closed.{" "}
          {i < settings.lastSavingsMonth ? (
            <>
              Your next payment will count toward <b>{MONTHS[i + 1]}</b>.
            </>
          ) : (
            "This is the last savings month of the year."
          )}
        </p>
        <div className="flex flex-col gap-1.5 rounded-card bg-soft p-4 text-sm font-bold">
          <span className="flex items-center gap-2">
            <Check size={16} />
            Optional. {MONTHS[i]} closes automatically after{" "}
            {formatShortDate(deadlineFor(year.year, i))}.
          </span>
          <span className="flex items-center gap-2">
            <X size={16} />
            You can’t add to {MONTHS[i]} after locking.
          </span>
        </div>
      </Modal>
    </Card>
  );
}

/** Monthly Savings Target: optional; progress resets each month; streak and months met. */
export function TargetCard({
  memberId,
  year,
  txs,
  now,
  settings,
  onChange,
  compact,
}: Props & { compact?: boolean }) {
  const { repos } = useServices();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState("");
  const [all, setAll] = useState(true);
  const i = openMonth(year, now, settings);
  if (i === null || isCatchUp(year, i)) return null;
  const target = targetFor(year, i);
  const total = monthTotal(year, txs, i);
  const pct = target ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const hist = targetHistory(year, txs, now, settings);
  const streak = targetStreak(year, txs, now, settings);
  const amount = parseNairaInput(text);
  const err = text ? validateTarget(amount, settings, year.year) : null;
  return (
    <Card
      className={
        target && total >= target
          ? "border-[#bfe3d5] bg-linear-to-b from-[#f3fbf7] to-white"
          : ""
      }
    >
      <div className="flex items-start justify-between">
        <span className="flex flex-col">
          <span className="text-[13px] font-bold text-mute">
            {MONTHS[i]} target
          </span>
          <b className="text-xl">{target ? formatNaira(target) : "Not set"}</b>
        </span>
        {target ? (
          total >= target ? (
            <Pill tone="ok">Target met</Pill>
          ) : (
            <Pill tone="gold" icon={false}>
              {formatNaira(target - total)} to go
            </Pill>
          )
        ) : null}
      </div>
      {target > 0 && (
        <>
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-pill bg-soft"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i
              className={`block h-full rounded-pill transition-[width] duration-700 ${total >= target ? "bg-ok" : "bg-linear-to-r from-brand to-gold"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs font-semibold text-mute">
            <span>
              {formatNaira(total)} saved this month · {pct}%
            </span>
            <span>Resets each month</span>
          </div>
        </>
      )}
      {!compact && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {streak > 0 && (
            <span className="inline-flex h-6 items-center gap-1 rounded-pill bg-gold-tint px-2.5 text-xs font-extrabold text-pending">
              <Star size={13} />
              {streak}-month streak
            </span>
          )}
          <span className="text-xs font-semibold text-mute">
            Target met in {hist.filter(Boolean).length} of {hist.length} months
          </span>
        </div>
      )}
      <button
        className="mt-2 text-sm font-bold text-brand"
        onClick={() => {
          setText(target ? String(target / 100) : "");
          setEdit(true);
        }}
      >
        {target ? `Change ${MONTHS[i]} target` : "Set a target"}
      </button>
      <Modal
        open={edit}
        title="Monthly savings target"
        onClose={() => setEdit(false)}
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setEdit(false)}>
              Cancel
            </Button>
            <Button
              size="md"
              disabled={!amount || !!err}
              onClick={async () => {
                await repos.member.setTarget(
                  memberId,
                  year.year,
                  i,
                  amount,
                  all,
                );
                toast(`${MONTHS[i]} target set to ${formatNaira(amount)}.`);
                setEdit(false);
                onChange();
              }}
            >
              Save target
            </Button>
          </>
        }
      >
        <p className="text-mute">
          A goal for {MONTHS[i]}. It isn’t enforced: we show your progress,
          remind you, and celebrate when you reach it.
        </p>
        <TextField
          label={`${MONTHS[i]} target`}
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
          error={err ?? undefined}
        />
        <div className="flex flex-wrap gap-2">
          {[10_000, 20_000, 30_000, 50_000].map((v) => (
            <Button
              key={v}
              size="sm"
              variant={amount === naira(v) ? "dark" : "outline"}
              onClick={() => setText(String(v))}
            >
              {formatNaira(naira(v))}
            </Button>
          ))}
        </div>
        <Checkbox checked={all} onChange={setAll}>
          Use this target for the following months too
        </Checkbox>
      </Modal>
    </Card>
  );
}
