import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import type { Testimonial } from "@/domain/entities";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { Banner, Button, Card, Checkbox, EmptyState, Modal, Pill, SelectField, TextField } from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";

const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

/** ADM-28: website testimonials. Published items appear on the home page in order. */
export function ContentPage() {
  const { repos, clock } = useServices();
  const toast = useToast();
  const { session } = useAuth();
  const [list, setList] = useState<Testimonial[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [name, setName] = useState("");
  const [descriptor, setDescriptor] = useState("");
  const [quote, setQuote] = useState("");
  const [status, setStatus] = useState<Testimonial["status"]>("Draft");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = async () => setList(await repos.testimonials.listAll());
  useEffect(() => {
    reload();
  }, [repos]);

  const audit = (action: string, entity: string, change: string) =>
    session?.kind === "admin"
      ? repos.admin.logAudit({ at: clock.now().toISOString(), actor: session.admin.name,
          role: session.admin.role === "SuperAdmin" ? "Super Admin" : "Administrator", action, entity, change, category: "Members" })
      : Promise.resolve();

  const addNew = () => {
    setEditing(null);
    setName("");
    setDescriptor("");
    setQuote("");
    setStatus("Draft");
    setConsent(false);
    setOpen(true);
  };
  const edit = (t: Testimonial) => {
    setEditing(t);
    setName(t.name);
    setDescriptor(t.descriptor);
    setQuote(t.quote);
    setStatus(t.status);
    setConsent(true);
    setOpen(true);
  };

  const canSave = name.trim() && quote.trim().length > 10 && consent;
  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const saved = await repos.testimonials.save({ id: editing?.id, name: name.trim(), descriptor: descriptor.trim(), quote: quote.trim(), status });
      await audit(editing ? "Edited testimonial" : "Added testimonial", saved.name, saved.status);
      setOpen(false);
      await reload();
      toast("Testimonial saved.");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const flip = async (t: Testimonial) => {
    const next = t.status === "Published" ? "Draft" : "Published";
    await repos.testimonials.setStatus(t.id, next);
    await audit(next === "Published" ? "Published testimonial" : "Unpublished testimonial", t.name, next);
    await reload();
    toast(next === "Published" ? "Published on the website." : "Removed from the website.");
  };

  const move = async (t: Testimonial, direction: -1 | 1) => {
    try {
      setList(await repos.testimonials.move(t.id, direction));
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const remove = async (t: Testimonial) => {
    await repos.testimonials.remove(t.id);
    await audit("Deleted testimonial", t.name, "Deleted");
    await reload();
    toast("Testimonial deleted.");
  };

  return (
    <>
      <AdminPageHeader
        title="Content"
        sub="Website content managed by Iconic Wealth Hub"
        actions={<Button size="md" icon={<Plus size={18} />} onClick={addNew}>Add testimonial</Button>}
      />
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <h2 className="text-base font-extrabold">Testimonials</h2>
        <Banner tone="info">
          Published testimonials appear on the website home page in this order. Only publish with the member’s consent.
        </Banner>
        {list.length === 0 ? (
          <Card><EmptyState icon={<Plus size={24} />} title="No testimonials yet">Add the first one.</EmptyState></Card>
        ) : (
          list.map((t, i) => (
            <Card key={t.id} className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e4d7fb] text-sm font-extrabold text-[#3b1580]">{initials(t.name)}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{t.name}</b>
                  <span className="text-[13px] font-semibold text-mute">{t.descriptor}</span>
                  <Pill tone={t.status === "Published" ? "ok" : "mute"}>{t.status}</Pill>
                </div>
                <q className="font-display text-[17px] leading-snug">“{t.quote}”</q>
              </div>
              <div className="flex shrink-0 flex-row items-center gap-1 sm:flex-col">
                <button aria-label="Move up" disabled={i === 0} onClick={() => move(t, -1)} className="flex size-9 items-center justify-center rounded-full border-[1.5px] border-line disabled:opacity-40"><ChevronUp size={16} /></button>
                <button aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(t, 1)} className="flex size-9 items-center justify-center rounded-full border-[1.5px] border-line disabled:opacity-40"><ChevronDown size={16} /></button>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm font-bold">
                <button className="text-brand" onClick={() => edit(t)}>Edit</button>
                <button className="text-brand" onClick={() => flip(t)}>{t.status === "Published" ? "Unpublish" : "Publish"}</button>
                <button className="text-fail" onClick={() => remove(t)}>Delete</button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        open={open}
        title={editing ? "Edit testimonial" : "Add testimonial"}
        onClose={() => setOpen(false)}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!canSave || busy} title={canSave ? undefined : "Add a name, a testimonial and confirm consent."} onClick={save}>Save testimonial</Button></>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Name shown" placeholder="e.g. Ngozi O." value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Descriptor" placeholder="Member since 2024 · Abuja" value={descriptor} onChange={(e) => setDescriptor(e.target.value)} />
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-bold">Testimonial
          <textarea rows={4} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="2–3 sentences in the member’s own words"
            className="w-full rounded-input border-[1.5px] border-line bg-white p-3.5 text-[15px] font-semibold outline-none focus:border-brand" />
        </label>
        <SelectField label="Status" options={["Draft", "Published"]} value={status} onChange={(e) => setStatus(e.target.value as Testimonial["status"])} />
        <Checkbox checked={consent} onChange={setConsent}>The member has agreed to appear on the website.</Checkbox>
      </Modal>
    </>
  );
}
