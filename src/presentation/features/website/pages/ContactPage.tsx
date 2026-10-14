import { useId, useState } from "react";
import { Mail, MapPin, MessageCircle, TriangleAlert } from "lucide-react";
import {
  Button,
  ButtonLink,
  OpenDecisionTag,
  SelectField,
  TextField,
  cn,
} from "../../../design-system";
import { useToast } from "../../../contexts/ToastContext";
import { env } from "@/app/config/env";

const TOPICS = [
  "Membership",
  "Payments",
  "Savings",
  "Payout",
  "Something else",
] as const;

function MessageField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col">
      <label htmlFor={id} className="mb-2 text-sm font-bold">
        Message
      </label>
      <textarea
        id={id}
        rows={5}
        value={value}
        placeholder="How can we help?"
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className={cn(
          "w-full rounded-input border-[1.5px] bg-white px-3.5 py-3 text-[15px] font-semibold text-ink outline-none transition focus:border-brand focus:ring-[3px] focus:ring-brand/15",
          error ? "border-fail" : "border-line",
        )}
      />
      {error ? (
        <p
          id={`${id}-err`}
          className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold text-fail"
        >
          <TriangleAlert size={16} />
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-[13px] font-semibold leading-snug text-mute">
          Don’t include card details or passwords.
        </p>
      )}
    </div>
  );
}

export function ContactPage() {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<string>("Membership");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function send() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      e.email = "Enter a valid email address.";
    if (phone.replace(/\D/g, "").length < 11)
      e.phone = "Enter an 11-digit phone number.";
    if (!message.trim()) e.message = "Write a short message.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setName("");
    setPhone("");
    setEmail("");
    setTopic("Membership");
    setMessage("");
    toast("Message sent. We’ll reply by email within one working day.");
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-soft px-5 pt-16 pb-10 lg:px-16">
        <div className="mx-auto max-w-360">
          <h1 className="font-display text-5xl leading-[1.04] tracking-tight lg:text-[60px]">
            Contact us
          </h1>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-[#474252]">
            Questions about membership, a payment or your savings? Send us a
            message, or chat with support on WhatsApp.
          </p>
        </div>
      </section>

      <section className="mx-auto flex max-w-360 flex-col gap-10 px-5 py-14 lg:flex-row lg:px-16">
        <form
          className="flex w-155 max-w-full flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              error={errors.name}
            />
            <TextField
              label="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
              error={errors.phone}
            />
          </div>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            error={errors.email}
          />
          <SelectField
            label="Topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            options={TOPICS}
          />
          <MessageField
            value={message}
            onChange={setMessage}
            error={errors.message}
          />
          <div>
            <Button type="submit">Send message</Button>
          </div>
        </form>

        <div className="flex flex-1 flex-col gap-4 rounded-card bg-soft p-7">
          <h2 className="text-[19px] font-extrabold">Other ways to reach us</h2>
          <ButtonLink
            to={env.waSupportUrl}
            external
            icon={<MessageCircle size={18} />}
          >
            Chat with support on WhatsApp
          </ButtonLink>
          <span className="flex items-center gap-3 text-[15px] font-semibold">
            <Mail size={20} className="shrink-0 text-mute" />
            Approved email address
          </span>
          <span className="flex items-center gap-3 text-[15px] font-semibold">
            <MapPin size={20} className="shrink-0 text-mute" />
            Approved office address
          </span>
          <div>
            <OpenDecisionTag code="CI-01">
              Contact details pending
            </OpenDecisionTag>
          </div>
        </div>
      </section>
    </>
  );
}
