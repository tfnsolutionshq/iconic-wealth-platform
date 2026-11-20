import { useState } from "react";
import { Check, Lock, X } from "lucide-react";
import type { Kobo, MonthIndex } from "@/domain/entities";
import { MONTHS, formatNaira, formatShortDate } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { Button, Card, Modal } from "../../../design-system";

interface LockMonthModalProps {
  open: boolean;
  onClose: () => void;
  memberId: string;
  year: number;
  /** 1-based month number (1 = January ... 11 = November). */
  month: number;
  /** Savings month UUID from savings_month.id / active_month.id for POST /savings/months/{id}/lock. */
  monthId?: string | null;
  monthName: string;
  savedAmount: Kobo;
  deadline: Date;
  onLocked?: () => void;
}

/**
 * Confirmation modal to lock an open normal savings month early once it has
 * at least the minimum payment saved. Not available for catch-up months.
 */
export function LockMonthModal({
  open,
  onClose,
  memberId,
  year,
  month,
  monthId,
  monthName,
  savedAmount,
  deadline,
  onLocked,
}: LockMonthModalProps) {
  const { repos } = useServices();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const nextMonthName = month < 11 ? MONTHS[month] : null;

  const handleLock = async () => {
    setBusy(true);
    try {
      await repos.member.lockMonth(
        memberId,
        year,
        Math.max(0, month - 1) as MonthIndex,
        monthId,
      );
      toast(
        `${monthName} locked. Next payments count toward ${nextMonthName ?? "January"}.`,
      );
      onClose();
      onLocked?.();
    } catch (e) {
      toast((e as Error).message || `Could not lock ${monthName} right now.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Lock ${monthName}?`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="md" onClick={onClose} disabled={busy}>
            Not now
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={<Lock size={18} />}
            disabled={busy}
            onClick={handleLock}
          >
            {busy ? "Locking…" : `Lock ${monthName}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <span className="flex size-13 items-center justify-center rounded-2xl bg-brand-tint text-brand-dark">
          <Lock size={26} />
        </span>
        <p className="leading-relaxed text-[#474252]">
          {monthName} will be saved at <b>{formatNaira(savedAmount)}</b> and
          closed.{" "}
          {nextMonthName ? (
            <>
              Your next payment will count toward <b>{nextMonthName}</b>.
            </>
          ) : (
            "This is the last savings month of the year; payments reopen in January."
          )}
        </p>
        <Card tone="soft" className="flex flex-col gap-2 bg-soft p-3.5">
          <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
            <Check size={16} strokeWidth={2.4} className="shrink-0" />
            <span>
              Locking early is optional. {monthName} locks automatically after{" "}
              {formatShortDate(deadline)}.
            </span>
          </div>
          <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
            <X size={16} strokeWidth={2.4} className="shrink-0" />
            <span>You can’t add to {monthName} after locking.</span>
          </div>
        </Card>
      </div>
    </Modal>
  );
}

