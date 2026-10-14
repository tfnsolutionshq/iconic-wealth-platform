import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';

const ToastContext = createContext<(message: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const toast = useCallback((m: string) => { setMsg(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(null), 3000); }, []);
  return <ToastContext.Provider value={toast}>{children}
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
      <AnimatePresence>{msg && <motion.div key={msg} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
        className="flex max-w-[90vw] items-center gap-2.5 rounded-[14px] bg-ink px-[18px] py-3 text-sm font-bold text-white"><Check size={18} />{msg}</motion.div>}</AnimatePresence>
    </div>
  </ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
