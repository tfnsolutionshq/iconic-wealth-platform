import { cn } from '../cn';

type ChipsVariant = 'pill' | 'underline';

/** Tab-style filter chips (e.g. members tabs with counts). */
export function Chips<T extends string>({ value, options, onChange, variant = 'pill' }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; variant?: ChipsVariant }) {
  const underline = variant === 'underline';
  return <div role="tablist" className={cn(underline ? 'flex flex-wrap gap-1 border-b border-line' : 'flex flex-wrap gap-2')}>
    {options.map(o => {
      const active = o.value === value;
      return <button key={o.value} role="tab" aria-selected={active} onClick={() => onChange(o.value)}
        className={cn(underline
          ? cn('-mb-px shrink-0 border-x-0 border-t-0 border-b-[3px] bg-transparent px-4 py-3 text-sm font-bold whitespace-nowrap',
            active ? 'border-brand text-brand-dark' : 'border-transparent text-mute')
          : cn('inline-flex h-[38px] items-center gap-1.5 rounded-pill border-[1.5px] px-4 text-sm font-bold whitespace-nowrap transition',
            active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-[#474252] hover:border-brand'))}>{o.label}</button>;
    })}
  </div>;
}
