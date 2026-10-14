import type { SavingsYear, Transaction } from '@/domain/entities';
import { MONTHS, MONTHS_SHORT, monthState, type MonthState, type PlatformSettings } from '@/domain/rules';
import { cn } from '../cn';

const LOOK: Record<MonthState, { light: string; dark: string; glyph: string }> = {
  saved: { light: 'bg-brand text-white', dark: 'bg-[#9b6bf2] text-white', glyph: '✓' },
  missed: { light: 'bg-fail-tint text-fail', dark: 'bg-[#f26050]/30 text-white', glyph: '×' },
  open: { light: 'border-2 border-ink', dark: 'border-2 border-white', glyph: '' },
  ahead: { light: 'border-2 border-ink', dark: 'border-2 border-white', glyph: '' },
  catchup: { light: 'border-2 border-dashed border-gold text-gold', dark: 'border-2 border-dashed border-gold text-gold', glyph: '' },
  catchupWaiting: { light: 'border-2 border-dashed border-gold text-gold', dark: 'border-2 border-dashed border-gold text-gold', glyph: '' },
  next: { light: 'bg-soft', dark: 'bg-white/10', glyph: '' },
  upcoming: { light: 'bg-soft', dark: 'bg-white/10', glyph: '' },
  beforeJoining: { light: 'border-[1.5px] border-dashed border-current opacity-50', dark: 'border-[1.5px] border-dashed border-current opacity-50', glyph: '–' },
  payout: { light: 'bg-gold-tint text-[#7a4a00]', dark: 'bg-gold/25 text-[#f7c97e]', glyph: '₦' },
};
/** January–November savings months plus December payout. Status = glyph + colour (never colour alone). */
export function YearStrip({ year, txs, now, settings, onDark }: { year: SavingsYear; txs: Transaction[]; now: Date; settings: PlatformSettings; onDark?: boolean }) {
  return <div className="grid grid-cols-12 gap-1">
    {MONTHS_SHORT.map((label, i) => { const st = monthState(year, txs, i, now, settings); const l = LOOK[st];
      return <span key={label} title={`${MONTHS[i]}${st === 'payout' ? ' · payout month' : ''}`} className={cn('flex flex-col items-center gap-1 text-[10.5px] font-bold', onDark ? 'text-white/60' : 'text-mute')}>
        <i className={cn('flex h-[30px] w-full items-center justify-center rounded-lg text-xs font-extrabold not-italic', onDark ? l.dark : l.light)}>{l.glyph}</i>{label[0]}</span>; })}
  </div>;
}
