import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, ChevronRight, KeyRound, Landmark, LogOut, MessageCircle, TriangleAlert } from 'lucide-react';
import type { ChangeField } from '@/domain/repositories';
import { NG_STATES, isStrongPassword } from '@/domain/rules';
import { useAuth } from '../../../contexts/AuthContext';
import { useServices } from '../../../contexts/ServicesContext';
import { useToast } from '../../../contexts/ToastContext';
import { Button, Card, Modal, Pill, SelectField, TextField } from '../../../design-system';
import { paths } from '../../../routes/paths';

const CHANGE_OPTIONS: ChangeField[] = ['Phone number', 'Email', 'Payout account'];

function dob(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** MEM-15: state, address and next of kin are editable; name, DOB, phone, email and payout account are read-only with "Request a change". */
export function ProfilePage() {
  const { session, updateMember, logout } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const member = session?.kind === 'member' ? session.member : null;

  const [state, setState] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [nokName, setNokName] = useState<string | null>(null);
  const [nokPhone, setNokPhone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [reqField, setReqField] = useState<ChangeField | null>(null);
  const [reqValue, setReqValue] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqBusy, setReqBusy] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');

  if (!member) return <p className="text-mute">Loading…</p>;
  const curState = state ?? member.stateOfResidence;
  const curAddress = address ?? member.address;
  const curNokName = nokName ?? member.nextOfKin.name;
  const curNokPhone = nokPhone ?? member.nextOfKin.phone;
  const dirty = curState !== member.stateOfResidence || curAddress !== member.address || curNokName !== member.nextOfKin.name || curNokPhone !== member.nextOfKin.phone;
  const nokPhoneError = curNokPhone.trim() && curNokPhone.replace(/\D/g, '').length < 11 ? 'Enter an 11-digit phone number.' : undefined;
  const stateError = !curState ? 'Select your state of residence.' : undefined;
  const addressError = curAddress.trim().length < 5 ? 'Enter your residential address.' : undefined;

  const save = () => {
    if (stateError || addressError || nokPhoneError || !curNokName.trim()) return;
    setSaving(true);
    updateMember({ ...member, stateOfResidence: curState, address: curAddress.trim(), nextOfKin: { ...member.nextOfKin, name: curNokName.trim(), phone: curNokPhone.trim() } });
    setSaving(false);
    toast('Profile updated.');
  };

  const openRequest = (f: ChangeField) => { setReqField(f); setReqValue(''); setReqReason(''); };
  const sendRequest = async () => {
    if (!reqField || !reqValue.trim()) return;
    setReqBusy(true);
    try {
      await repos.member.requestChange(member.id, reqField, reqValue.trim(), reqReason.trim());
      setReqField(null);
      toast('Request sent. We’ll be in touch to confirm.');
    } catch (e) { toast((e as Error).message); } finally { setReqBusy(false); }
  };

  const pwMismatch = pwConfirm && pwConfirm !== pwNext ? 'Passwords don’t match.' : undefined;
  const pwValid = pwCurrent.length > 0 && isStrongPassword(pwNext) && pwNext === pwConfirm;

  const since = (() => {
    const d = new Date(member.joinedOn);
    return Number.isNaN(d.getTime()) ? member.joinedOn : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  })();

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-4">
      <h1 className="text-[28px] font-extrabold tracking-tight">Profile</h1>

      <Card className="flex items-center gap-3.5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#e4d7fb] text-lg font-extrabold text-[#3b1580]">
          {member.firstName[0]}{member.lastName[0]}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <b className="text-[17px]">{member.firstName} {member.lastName}</b>
          <span className="text-[13px] font-semibold text-mute">Member {member.id} · since {since}</span>
        </span>
        <Pill tone={member.status === 'Active' ? 'ok' : 'fail'} icon={false}>{member.status}</Pill>
      </Card>

      <Card className="flex flex-col gap-3.5">
        <h2 className="text-base font-extrabold">Personal details</h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <TextField label="Full name" value={`${member.firstName} ${member.lastName}`} readOnly />
          <TextField label="Date of birth" value={dob(member.dateOfBirth)} readOnly />
        </div>
        <p className="-mt-2 text-[13px] font-semibold text-mute">To change your name or date of birth, contact Iconic Wealth Hub.</p>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <TextField label="Phone number" value={member.phone} readOnly />
          <TextField label="Email" value={member.email} readOnly />
        </div>
        <div className="-mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-mute">Phone number and email are changed by Iconic Wealth Hub to protect your account.</span>
          <button className="text-sm font-bold text-brand" onClick={() => openRequest('Phone number')}>Request a change</button>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <SelectField label="State of residence" value={curState} onChange={(e) => setState(e.target.value)} options={NG_STATES} placeholder="Select state" error={stateError} />
          <TextField label="Address" value={curAddress} onChange={(e) => setAddress(e.target.value)} error={addressError} />
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <TextField label="Next of kin" value={curNokName} onChange={(e) => setNokName(e.target.value)} error={!curNokName.trim() ? 'Enter your next of kin’s name.' : undefined} />
          <TextField label="Next of kin phone" value={curNokPhone} onChange={(e) => setNokPhone(e.target.value.replace(/[^\d+\s]/g, ''))} error={nokPhoneError} />
        </div>
        <Button onClick={save} disabled={!dirty || !!stateError || !!addressError || !!nokPhoneError || !curNokName.trim() || saving} className="self-start">
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </Card>

      <Card className="flex flex-col gap-2.5">
        <h2 className="text-base font-extrabold">Payout account</h2>
        {member.payoutAccount ? (
          <>
            <div className="flex items-center gap-3">
              <span className="flex size-[42px] items-center justify-center rounded-[14px] bg-soft"><Landmark size={20} /></span>
              <span className="flex min-w-0 flex-1 flex-col">
                <b>{member.payoutAccount.bankName} •••• {member.payoutAccount.accountNumber.slice(-4)}</b>
                <span className="text-[13px] font-semibold text-mute">{member.payoutAccount.accountName}</span>
              </span>
              <Pill tone="ok">Verified</Pill>
            </div>
            <button className="self-start text-sm font-bold text-brand" onClick={() => openRequest('Payout account')}>Request a change</button>
          </>
        ) : <span className="text-[13px] font-semibold text-mute">Not set up yet.</span>}
        <span className="text-[13px] font-semibold text-mute">To change your payout account, contact Iconic Wealth Hub.</span>
      </Card>

      <Card className="px-[18px] py-1">
        <button className="flex w-full items-center gap-3 border-b border-line py-3 text-left" onClick={() => setPwOpen(true)}>
          <KeyRound size={20} /><b className="flex-1">Change password</b><ChevronRight size={18} />
        </button>
        <Link to={paths.member.payout} className="flex items-center gap-3 border-b border-line py-3 no-underline">
          <Banknote size={20} /><b className="flex-1 text-ink">Year-end payout</b><ChevronRight size={18} className="text-ink" />
        </Link>
        <Link to={paths.member.support} className="flex items-center gap-3 border-b border-line py-3 no-underline">
          <MessageCircle size={20} /><b className="flex-1 text-ink">Support</b><ChevronRight size={18} className="text-ink" />
        </Link>
        <button className="flex w-full items-center gap-3 py-3 text-left text-fail" onClick={() => logout()}>
          <LogOut size={20} /><b className="flex-1">Log out</b>
        </button>
      </Card>

      <Modal open={reqField !== null} title="Request a change" onClose={() => setReqField(null)}
        footer={<><Button variant="outline" size="md" onClick={() => setReqField(null)}>Cancel</Button>
          <Button size="md" disabled={!reqValue.trim() || reqBusy} onClick={sendRequest}>{reqBusy ? 'Sending…' : 'Send request'}</Button></>}>
        <p className="text-mute">For your security, these details are changed by Iconic Wealth Hub. We’ll confirm with you before updating them.</p>
        <SelectField label="What do you want to change?" value={reqField ?? ''} onChange={(e) => setReqField(e.target.value as ChangeField)} options={CHANGE_OPTIONS} />
        <TextField label={reqField === 'Payout account' ? 'New bank and account number' : `New ${reqField?.toLowerCase() ?? ''}`} value={reqValue} onChange={(e) => setReqValue(e.target.value)} />
        <TextField label="Reason" optional value={reqReason} onChange={(e) => setReqReason(e.target.value)} hint="e.g. I changed my phone number" />
      </Modal>

      <Modal open={pwOpen} title="Change password" onClose={() => setPwOpen(false)}
        footer={<><Button variant="outline" size="md" onClick={() => setPwOpen(false)}>Cancel</Button>
          <Button size="md" disabled={!pwValid} onClick={() => { setPwOpen(false); setPwCurrent(''); setPwNext(''); setPwConfirm(''); toast('Password updated.'); }}>Update password</Button></>}>
        <TextField label="Current password" type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
        <TextField label="New password" type="password" value={pwNext} onChange={(e) => setPwNext(e.target.value)}
          error={pwNext && !isStrongPassword(pwNext) ? 'Use at least 8 characters, with upper and lower case letters and a number.' : undefined} />
        <TextField label="Confirm new password" type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} error={pwMismatch} />
        {pwNext && !isStrongPassword(pwNext) && (
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-mute"><TriangleAlert size={14} />At least 8 characters, upper and lower case, and a number.</p>
        )}
      </Modal>
    </div>
  );
}
