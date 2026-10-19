import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../cn';

type Variant = 'primary' | 'outline' | 'dark' | 'gold' | 'danger';
type Size = 'lg' | 'md' | 'sm';
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  outline: 'bg-white text-ink border-[1.5px] border-line hover:border-brand hover:text-brand',
  dark: 'bg-ink text-white hover:bg-black',
  gold: 'bg-gold text-[#2a1a00] hover:brightness-95',
  danger: 'bg-fail text-white hover:brightness-95',
};
const sizes: Record<Size, string> = { lg: 'h-14 px-6 text-base', md: 'h-11 px-[18px] text-[15px]', sm: 'h-9 px-3.5 text-[13px]' };
const base = 'inline-flex items-center justify-center gap-2 rounded-pill text-center font-bold transition disabled:bg-soft disabled:text-[#a39dad] disabled:border-transparent disabled:cursor-not-allowed';

interface Common { variant?: Variant; size?: Size; full?: boolean; icon?: ReactNode; className?: string; children: ReactNode }
export type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ variant = 'primary', size = 'lg', full, icon, className, children, ...rest }, ref) => (
  <button ref={ref} className={cn(base, variants[variant], sizes[size], full && 'w-full', className)} {...rest}>{icon}{children}</button>
));
Button.displayName = 'Button';

/** Button-styled router link. Use `external` for WhatsApp and other off-site links. */
export function ButtonLink({ to, external, variant = 'primary', size = 'lg', full, icon, className, children }: Common & { to: string; external?: boolean }) {
  const cls = cn(base, variants[variant], sizes[size], full && 'w-full', className);
  return external
    ? <a href={to} target="_blank" rel="noopener noreferrer" className={cls}>{icon}{children}</a>
    : <Link to={to} className={cls}>{icon}{children}</Link>;
}
