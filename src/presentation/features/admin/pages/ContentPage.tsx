import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, FileText, Info, Plus } from "lucide-react";
import type { Testimonial } from "@/domain/entities";
import type { PageMeta } from "@/domain/repositories";
import { ValidationError } from "@/domain/errors";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Banner,
  Button,
  Card,
  Checkbox,
  EmptyState,
  LoadingScreen,
  Modal,
  Pill,
  SelectField,
  TextField,
  cn,
} from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";

type StatusFilter = "all" | "published" | "draft";

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** ADM-28: website testimonials backed by /admin/testimonials endpoints. */
export function ContentPage() {
  const { repos, clock } = useServices();
  const toast = useToast();
  const { session } = useAuth();

  const [list, setList] = useState<Testimonial[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PageMeta>({
    current_page: 1,
    per_page: 15,
    last_page: 1,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [name, setName] = useState("");
  const [descriptor, setDescriptor] = useState("");
  const [quote, setQuote] = useState("");
  const [status, setStatus] = useState<Testimonial["status"]>("Draft");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const reload = useCallback(
    async (targetFilter = filter, targetPage = page) => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await repos.testimonials.listAllPage({
          status: targetFilter === "all" ? undefined : targetFilter,
          page: targetPage,
          per_page: 15,
        });
        setList(res.data);
        setMeta(res.meta);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not load testimonials.";
        setLoadError(msg);
      } finally {
        setLoading(false);
      }
    },
    [repos, filter, page],
  );

  useEffect(() => {
    void reload(filter, page);
  }, [reload, filter, page]);

  const audit = (action: string, entity: string, change: string) =>
    session?.kind === "admin"
      ? repos.admin
          .logAudit({
            at: clock.now().toISOString(),
            actor: session.admin.name,
            role:
              session.admin.role === "SuperAdmin"
                ? "Super Admin"
                : "Administrator",
            action,
            entity,
            change,
            category: "Members",
          })
          .catch(() => {})
      : Promise.resolve();

  const addNew = () => {
    setEditing(null);
    setName("");
    setDescriptor("");
    setQuote("");
    setStatus("Draft");
    setConsent(false);
    setFormError(null);
    setFieldErrors({});
    setOpen(true);
  };

  const edit = (t: Testimonial) => {
    setEditing(t);
    setName(t.name);
    setDescriptor(t.descriptor);
    setQuote(t.quote);
    setStatus(t.status);
    setConsent(t.agreedToAppear ?? true);
    setFormError(null);
    setFieldErrors({});
    setOpen(true);
  };

  const canSave = name.trim() && quote.trim().length > 10 && consent;
  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const saved = await repos.testimonials.save({
        id: editing?.id,
        name: name.trim(),
        descriptor: descriptor.trim(),
        quote: quote.trim(),
        status,
        agreedToAppear: consent,
      });
      await audit(
        editing ? "Edited testimonial" : "Added testimonial",
        saved.name,
        saved.status,
      );
      setOpen(false);
      await reload(filter, page);
      toast(editing ? "Testimonial updated." : "Testimonial created.");
    } catch (e) {
      if (e instanceof ValidationError) {
        const next: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(e.fields)) {
          if (msgs[0]) next[k] = msgs[0];
        }
        setFieldErrors(next);
        setFormError(e.message);
      } else {
        const msg =
          e instanceof Error ? e.message : "Could not save testimonial.";
        setFormError(msg);
        toast(msg, "fail");
      }
    } finally {
      setBusy(false);
    }
  };

  const flip = async (t: Testimonial) => {
    if (actionId) return;
    const next = t.status === "Published" ? "Draft" : "Published";
    setActionId(t.id);
    try {
      await repos.testimonials.setStatus(t.id, next);
      await audit(
        next === "Published"
          ? "Published testimonial"
          : "Unpublished testimonial",
        t.name,
        next,
      );
      await reload(filter, page);
      toast(
        next === "Published"
          ? "Published on the website."
          : "Removed from the website.",
      );
    } catch (e) {
      toast(
        e instanceof Error
          ? e.message
          : "Could not update testimonial status.",
        "fail",
      );
    } finally {
      setActionId(null);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    setList((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const remove = async (t: Testimonial) => {
    if (actionId) return;
    setActionId(t.id);
    try {
      await repos.testimonials.remove(t.id);
      await audit("Deleted testimonial", t.name, "Deleted");
      await reload(filter, page);
      toast("Testimonial deleted.");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Could not delete testimonial.",
        "fail",
      );
    } finally {
      setActionId(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Content"
        sub="Website content managed by Iconic Wealth Hub"
        actions={
          <Button size="md" icon={<Plus size={18} />} onClick={addNew}>
            Add testimonial
          </Button>
        }
      />
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line">
          <div className="flex items-center gap-6">
            <button
              type="button"
              className="-mb-px border-b-2 border-brand pb-3 text-[15px] font-extrabold text-brand-dark"
            >
              Testimonials
            </button>
          </div>
          <div className="flex items-center gap-1.5 pb-2">
            {(
              [
                ["all", "All"],
                ["published", "Published"],
                ["draft", "Draft"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFilter(value);
                  setPage(1);
                }}
                className={cn(
                  "rounded-pill border px-3 py-1 text-xs font-bold transition-colors",
                  filter === value
                    ? "border-brand bg-brand-tint text-brand-dark"
                    : "border-line bg-white text-mute hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Banner tone="info" icon={<Info size={20} className="shrink-0" />}>
          Published testimonials appear on the website home page in this order.
          Only publish with the member’s consent.
        </Banner>

        {loadError && (
          <Banner tone="fail">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void reload(filter, page)}
                className="font-extrabold underline"
              >
                Retry
              </button>
            </div>
          </Banner>
        )}

        {loading && list.length === 0 ? (
          <LoadingScreen label="Loading testimonials..." />
        ) : list.length === 0 ? (
          <Card>
            <EmptyState icon={<FileText size={28} />} title="No testimonials yet">
              {filter === "all"
                ? "Add the first one."
                : `No ${filter} testimonials found.`}
            </EmptyState>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((t, i) => {
              const itemBusy = actionId === t.id;
              return (
                <Card
                  key={t.id}
                  className="flex flex-col gap-4 sm:flex-row sm:items-start"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e4d7fb] text-sm font-extrabold text-[#3b1580]">
                    {initials(t.name)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <b className="text-[15px] text-ink">{t.name}</b>
                      <span className="text-[13px] font-semibold text-mute">
                        {t.descriptor}
                      </span>
                      <Pill tone={t.status === "Published" ? "ok" : "mute"}>
                        {t.status}
                      </Pill>
                    </div>
                    <p className="font-display text-[16.5px] leading-[1.55] text-[#474252]">
                      “{t.quote}”
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={i === 0 || itemBusy}
                        onClick={() => move(i, -1)}
                        className="flex size-9 items-center justify-center rounded-full border-[1.5px] border-line bg-white text-ink transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={i === list.length - 1 || itemBusy}
                        onClick={() => move(i, 1)}
                        className="flex size-9 items-center justify-center rounded-full border-[1.5px] border-line bg-white text-ink transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={itemBusy}
                        className="h-8 px-3 text-xs"
                        onClick={() => edit(t)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={t.status === "Published" ? "outline" : "primary"}
                        disabled={itemBusy}
                        className="h-8 px-3 text-xs"
                        onClick={() => void flip(t)}
                      >
                        {t.status === "Published" ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={itemBusy}
                        className="h-8 px-3 text-xs !text-fail hover:!border-fail hover:!text-fail"
                        onClick={() => void remove(t)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {meta.last_page > 1 && (
          <div className="flex items-center justify-between text-sm font-semibold text-mute">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-line bg-white px-3 py-1.5 font-bold text-ink disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {meta.current_page} of {meta.last_page}
            </span>
            <button
              type="button"
              disabled={page >= meta.last_page || loading}
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              className="rounded-lg border border-line bg-white px-3 py-1.5 font-bold text-ink disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <Modal
        open={open}
        title={editing ? "Edit testimonial" : "Add testimonial"}
        onClose={() => !busy && setOpen(false)}
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!canSave || busy}
              title={
                canSave
                  ? undefined
                  : "Add a name, a testimonial and confirm consent."
              }
              onClick={() => void save()}
            >
              {busy ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        {formError && <Banner tone="fail">{formError}</Banner>}
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Name shown"
            placeholder="e.g. Ngozi O."
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
          />
          <TextField
            label="Descriptor"
            placeholder="e.g. Member since 2023 · Lagos"
            value={descriptor}
            onChange={(e) => setDescriptor(e.target.value)}
            error={fieldErrors.descriptor}
          />
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Testimonial
          <textarea
            rows={4}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="2–3 sentences in the member’s own words"
            className="w-full rounded-input border-[1.5px] border-line bg-white p-3.5 text-[15px] font-semibold outline-none focus:border-brand"
          />
          <span className="text-xs font-semibold text-mute">
            Keep it to two or three sentences.
          </span>
          {fieldErrors.content && (
            <span className="text-[13px] font-bold text-fail">
              {fieldErrors.content}
            </span>
          )}
        </label>
        {!editing && (
          <SelectField
            label="Status"
            options={["Draft", "Published"]}
            value={status}
            onChange={(e) => setStatus(e.target.value as Testimonial["status"])}
          />
        )}
        <Checkbox checked={consent} onChange={setConsent}>
          The member has agreed to this testimonial being published.
        </Checkbox>
      </Modal>
    </>
  );
}
