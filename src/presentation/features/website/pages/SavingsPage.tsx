import { chargeBreakdown, formatNaira, naira } from "@/domain/rules";
import { OpenDecisionTag } from "../../../design-system";

const EXAMPLE_AMOUNTS = [10_000, 25_000, 50_000] as const;

const EXPLAINERS = [
  {
    title: "Contributions",
    body: (
      <>
        Each payment is at least <b className="text-ink">₦10,000</b>, with no
        maximum. Save as much as you can each month, in as many payments as you
        like. Set a monthly target to keep yourself on track; it’s a goal, not a
        rule.
      </>
    ),
  },
  {
    title: "Months and deadlines",
    body: (
      <>
        The savings year runs from January to November. Each month opens on the
        1st and closes at the end of the 5th of the following month. Once a
        month has <b className="text-ink">₦10,000</b> or more, you can lock it
        early so your next payments count toward the following month.
      </>
    ),
  },
  {
    title: "Joining mid-year",
    body: (
      <>
        Approved by the end of September? You first clear the earlier months as
        catch-up, at <b className="text-ink">₦10,000</b> each. Approved after
        September? Your savings start the next January.
      </>
    ),
  },
  {
    title: "Withdrawals",
    body: (
      <>
        Savings are held until year-end and paid out on payout day, on or before{" "}
        <b className="text-ink">14 December</b>. Withdrawals are not available
        before then.
      </>
    ),
  },
] as const;

export function SavingsPage() {
  const rows = EXAMPLE_AMOUNTS.map((v) =>
    chargeBreakdown(naira(v), undefined, "Online"),
  );
  return (
    <>
      {/* Hero */}
      <section className="bg-soft px-5 pt-16 pb-10 lg:px-16">
        <div className="mx-auto max-w-360">
          <h1 className="max-w-[18ch] font-display text-4xl leading-[1.04] tracking-tight sm:text-5xl lg:text-[60px]">
            Savings
          </h1>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-[#474252]">
            Saving is what the community is about: every month from January to
            November, at your own pace, with one payout in December.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-360 gap-10 px-5 py-14 lg:grid-cols-2 lg:gap-16 lg:px-16">
        {/* Explainers */}
        <div className="flex min-w-0 flex-col gap-6">
          {EXPLAINERS.map((s) => (
            <div key={s.title} className="flex flex-col gap-2">
              <h2 className="text-[28px] font-extrabold tracking-tight">
                {s.title}
              </h2>
              <p className="max-w-[56ch] leading-relaxed text-mute">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Charges + interest */}
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-[28px] font-extrabold tracking-tight">
              Charges
            </h2>
            <p className="leading-relaxed text-mute">
              A <b className="text-ink">₦100 platform charge</b> applies to
              online card payments. Bank transfers and wallet payments are free.
              Any charge is included in the total you see before you pay.
            </p>
            <div className="max-w-full overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full min-w-130 text-sm">
                <thead>
                  <tr className="bg-soft text-left text-xs font-bold text-mute">
                    <th className="px-3.5 py-2.5 font-bold">You save</th>
                    <th className="px-3.5 py-2.5 text-right font-bold">
                      Platform charge
                    </th>
                    <th className="px-3.5 py-2.5 text-right font-bold">
                      Total to pay
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr
                      key={b.amount}
                      className="border-t border-line font-semibold last:border-b-0"
                    >
                      <td className="px-3.5 py-3 tabular-nums">
                        {formatNaira(b.amount)}
                      </td>
                      <td className="px-3.5 py-3 text-right tabular-nums">
                        {formatNaira(b.platformCharge)}
                      </td>
                      <td className="px-3.5 py-3 text-right font-extrabold tabular-nums">
                        {formatNaira(b.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 rounded-card bg-soft p-5.5">
            <h3 className="text-[19px] font-extrabold">Annual interest</h3>
            <p className="leading-relaxed text-mute">
              Interest is decided each year by Iconic Wealth Hub. Members see
              the amount due to them in their portal, with their payout.
            </p>
            <div>
              <OpenDecisionTag code="OD-01/02">
                Interest eligibility and calculation
              </OpenDecisionTag>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
