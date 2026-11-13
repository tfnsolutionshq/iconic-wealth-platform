import { useEffect, useState } from "react";
import type { Kobo } from "@/domain/entities";
import { formatNaira, naira, parseNairaInput } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { Button, Modal, TextField } from "../../../design-system";

interface SavingsTargetModalProps {
  open: boolean;
  onClose: () => void;
  memberId: string;
  year: number;
  /** The savings month the target belongs to, e.g. "November". */
  monthName: string;
  /** Current target in kobo, or null when none is set. */
  target: Kobo | null;
  /** The minimum per payment, which is also the smallest allowed target. */
  minimum: Kobo;
  /** Called after POST /savings/target succeeds so the page can reload. */
  onSaved?: () => void;
}

/**
 * The optional monthly savings target modal used by the member dashboard and
 * savings page. Saves through POST /savings/target, which takes naira.
 */
export function SavingsTargetModal({
  open,
  onClose,
  memberId,
  year,
  monthName,
  target,
  minimum,
  onSaved,
}: SavingsTargetModalProps) {
  const { repos } = useServices();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset the field each time the modal opens so it starts from the saved target.
  useEffect(() => {
    if (!open) return;
    setText(target ? String(target / 100) : "");
    setBusy(false);
  }, [open, target]);

  const amount = parseNairaInput(text);
  const error =
    text && amount < minimum
      ? `Set at least ${formatNaira(minimum)}.`
      : null;

  return (
    <Modal
      open={open}
      title="Monthly savings target"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="md" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="md"
            disabled={!amount || !!error || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await repos.savingsTarget.setTarget(memberId, year, amount);
                toast(`${monthName} target set to ${formatNaira(amount)}.`);
                onClose();
                onSaved?.();
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Save target
          </Button>
        </>
      }
    >
      <p className="text-mute">
        A goal for {monthName}. It isn’t enforced: we show your progress,
        remind you, and celebrate when you reach it.
      </p>
      <TextField
        label={`${monthName} target`}
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
        error={error ?? undefined}
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
    </Modal>
  );
}
