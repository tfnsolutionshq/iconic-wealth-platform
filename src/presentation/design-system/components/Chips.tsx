import { cn } from '../cn';

/** Tab-style filter chips (e.g. members tabs with counts). */
export function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return <div role="tablist" className="flex flex-wrap gap-2">
    {options.map(o => <button key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}
      className={cn('inline-flex h-[38px] items-center gap-1.5 rounded-pill border-[1.5px] px-4 text-sm font-bold whitespace-nowrap transition',
        o.value === value ? 'border-ink bg-ink text-white' : 'border-line bg-white text-[#474252] hover:border-brand')}>{o.label}</button>)}
  </div>;
}
