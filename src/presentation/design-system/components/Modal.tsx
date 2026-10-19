import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../cn";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  locked?: boolean;
}

/** Accessible dialog. `locked` = mandatory step: no close button, backdrop and Escape do nothing. */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
  locked,
}: ModalProps) {
  useEffect(() => {
    if (!open || locked) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, locked, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5">
          <motion.div
            className="absolute inset-0 bg-ink/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !locked && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl",
              wide ? "sm:max-w-195" : "sm:max-w-130",
            )}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <div className="flex items-center gap-3 px-6 pt-5 pb-2">
              <h2 className="flex-1 text-[19px] font-extrabold">{title}</h2>
              {!locked && (
                <button
                  aria-label="Close"
                  onClick={onClose}
                  className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3.5 overflow-auto px-6 pt-2 pb-4">
              {children}
            </div>
            {footer && (
              <div className="flex flex-col-reverse gap-2.5 border-t border-line px-6 pt-3.5 pb-5 sm:flex-row sm:flex-wrap sm:justify-end [&>a]:w-full sm:[&>a]:w-auto [&>button]:w-full sm:[&>button]:w-auto">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
