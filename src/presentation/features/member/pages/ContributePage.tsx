import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, ChevronLeft } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useContributionDraft } from "../../../contexts/ContributionDraftContext";
import {
  Button,
  Card,
  Pill,
  cn,
} from "../../../design-system";
import {
  DEFAULT_SETTINGS,
  MONTHS,
  formatNaira,
  parseNairaInput,
} from "@/domain/rules";
import { paths } from "../../../routes/paths";

const DEFAULT_MIN = DEFAULT_SETTINGS.minimumByYear[2026] ?? 10_000_00;

export function ContributePage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const draft = useContributionDraft();
  const member = session?.kind === "member" ? session.member : null;

  const now = new Date();
  const currentMonth = Math.min(now.getMonth(), 10);
  const currentYear = now.getFullYear();

  const [text, setText] = useState(
    draft.amount ? String(draft.amount / 100) : "",
  );

  const amount = text ? parseNairaInput(text) : DEFAULT_MIN;
  const isValid = amount >= DEFAULT_MIN;
  const error = !isValid
    ? `The minimum per payment is ${formatNaira(DEFAULT_MIN)}.`
    : null;

  const quick = [
    DEFAULT_MIN,
    DEFAULT_MIN * 2,
    DEFAULT_MIN * 3,
    DEFAULT_MIN * 5,
  ];

  if (!member) {
    return <p className="text-mute">Please log in to make a contribution.</p>;
  }

  return (
    <div className="mx-auto flex max-w-140 flex-col gap-4">
      <div className="flex h-13 items-center gap-3">
        <Link
          to={paths.member.home}
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line bg-white"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-[19px] font-extrabold">Contribute</h1>
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <span className="flex size-10.5 shrink-0 items-center justify-center rounded-input bg-soft">
          <Calendar size={20} />
        </span>
        <span className="flex min-w-0 flex-1 basis-40 flex-col">
          <b>
            This payment goes to {MONTHS[currentMonth]} {currentYear}
          </b>
          <span className="text-[13px] font-semibold text-mute">
            Minimum {formatNaira(DEFAULT_MIN)} per payment
          </span>
        </span>
        <Pill tone="ok">Open</Pill>
      </Card>

      <div>
        <label htmlFor="amount" className="mb-2 block text-sm font-bold">
          Amount
        </label>
        <div
          className={cn(
            "flex min-h-18 items-center gap-2 rounded-2xl border-2 bg-white px-4 py-2 text-2xl font-extrabold sm:text-3xl",
            isValid ? "border-brand" : "border-fail",
          )}
        >
          <span className="shrink-0 text-mute">₦</span>
          <input
            id="amount"
            inputMode="numeric"
            className="w-full min-w-0 bg-transparent tabular-nums outline-none"
            value={(amount / 100).toLocaleString("en-NG")}
            onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        {isValid ? (
          <p className="mt-1.5 text-[13px] font-semibold text-mute">
            Minimum {formatNaira(DEFAULT_MIN)} per payment. Pay as often as you
            like.
          </p>
        ) : (
          <p className="mt-1.5 text-[13px] font-bold text-fail">{error}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {quick.map((v) => (
          <Button
            key={v}
            size="sm"
            variant={amount === v ? "dark" : "outline"}
            onClick={() => setText(String(v / 100))}
          >
            {formatNaira(v)}
          </Button>
        ))}
      </div>

      <Button
        full
        disabled={!isValid}
        onClick={() => {
          draft.setAmount(amount);
          navigate(paths.member.review);
        }}
      >
        Review payment
      </Button>
    </div>
  );
}
