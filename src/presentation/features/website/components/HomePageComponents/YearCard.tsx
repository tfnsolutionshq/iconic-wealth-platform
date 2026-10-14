import { Check } from "lucide-react";
import { Pill } from "../../../../design-system";

/** Hero illustration from the approved build (static sample figures). */
export function YearCard() {
  const months = "JFMAMJJASOND".split("");
  return (
    <div className="relative py-5 pl-10">
      <div className="flex w-117.5 max-w-full flex-col gap-4.5 rounded-sheet bg-night p-6.5 text-white">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-white/65">
            Your 2026 savings
          </span>
          <Pill tone="brand" icon={<Check size={12} />}>
            On track for interest
          </Pill>
        </div>
        <div className="text-[44px] font-extrabold tracking-tight">
          ₦180,000
        </div>
        <div className="grid grid-cols-12 gap-1">
          {months.map((m, i) => (
            <span
              key={i}
              className="flex flex-col items-center gap-1 text-[10.5px] font-bold text-white/60"
            >
              <i
                className={`flex h-7.5 w-full items-center justify-center rounded-lg not-italic ${i < 8 ? "bg-[#9b6bf2]" : i === 8 ? "border-2 border-white" : "bg-white/10"}`}
              >
                {i < 8 ? "✓" : ""}
              </i>
              {m}
            </span>
          ))}
        </div>
        <div className="h-px bg-white/15" />
        <div className="flex items-center justify-between">
          <span className="flex flex-col">
            <span className="text-[13px] font-semibold text-white/65">
              September contribution
            </span>
            <b>Due by Mon 5 Oct</b>
          </span>
          <span className="rounded-pill bg-gold px-4.5 py-2.5 text-[15px] font-bold text-[#2a1a00]">
            Contribute
          </span>
        </div>
      </div>
      <div className="absolute -bottom-12 -left-2 flex w-82.5 items-center gap-3 rounded-card border border-line bg-white p-4 text-ink shadow-lift">
        <span className="flex size-10.5 items-center justify-center rounded-input bg-brand-tint text-brand-dark">
          <Check size={20} />
        </span>
        <span className="flex flex-1 flex-col">
          <b>August saved</b>
          <span className="text-[13px] font-semibold text-mute">
            ₦25,000 · paid 3 Sep
          </span>
        </span>
        <Pill tone="ok">On time</Pill>
      </div>
    </div>
  );
}
