import { useEffect, useState } from 'react';
import { Lock, Users } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useServices } from '../../../contexts/ServicesContext';
import { useToast } from '../../../contexts/ToastContext';
import { Banner, Button, Modal, SelectField, TextField } from '../../../design-system';
import { DEFAULT_SETTINGS, formatNaira, minimumFor, naira, parseNairaInput, validateTarget } from '@/domain/rules';

const BANKS = [['044', 'Access Bank'], ['011', 'First Bank'], ['058', 'GTBank'], ['50211', 'Kuda'], ['50515', 'Moniepoint'], ['999992', 'Opay'], ['033', 'UBA'], ['035', 'Wema Bank'], ['057', 'Zenith Bank']] as const;

/**
 * First-login setup (v5): payout account (required) → monthly savings target (optional).
 * The WhatsApp community is NOT part of onboarding: it unlocks after the first confirmed payment.
 */
export function OnboardingModal({ onDone }: { onDone?: () => void }) {
  const { session, updateMember } = useAuth(); const { repos, clock } = useServices(); const toast = useToast();
  const member = session?.kind === 'member' ? session.member : null;
  const [bank, setBank] = useState(''); const [acct, setAcct] = useState(''); const [acctName, setAcctName] = useState(''); const [target, setTarget] = useState(''); const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  useEffect(() => { repos.settings.get().then(setSettings); }, [repos]);
  useEffect(() => { if (acct.length === 10 && bank) repos.member.resolveAccountName(bank, acct).then(setAcctName); else setAcctName(''); }, [acct, bank, repos]);
  if (!member || member.onboarding === 'Complete') return null;
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  if (member.onboarding === 'PayoutAccount') return <Modal open locked title="Set up your payout details" onClose={() => {}}
    footer={<Button full disabled={!bank || acct.length !== 10 || busy} onClick={() => run(async () => {
      const bankName = BANKS.find(b => b[0] === bank)![1]; const payoutAccount = await repos.member.savePayoutAccount(member.id, { bankCode: bank, bankName, accountNumber: acct });
      updateMember({ ...member, payoutAccount, onboarding: 'Target' }); toast('Payout details saved.'); })}>Save and continue</Button>}>
    <p className="text-sm text-mute">Step 1 of 2 · Your savings and any interest are paid to this account on payout day. Required before you can save.</p>
    <SelectField label="Bank" value={bank} onChange={e => setBank(e.target.value)} options={BANKS.map(([value, label]) => ({ value, label }))} placeholder="Select your bank" />
    <TextField label="Account number" inputMode="numeric" value={acct} onChange={e => setAcct(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit account number"
      hint={acctName ? <span className="font-extrabold text-ok">✓ {acctName}</span> : 'We’ll check the account name matches yours.'} />
    <Banner tone="neutral" icon={<Lock size={20} />}>After this, changes to your payout account go through Iconic Wealth Hub for your protection.</Banner>
  </Modal>;

  const year = member.joinedOn > `${clock.now().getFullYear()}-${String(settings.cutoffMonth + 1).padStart(2, '0')}-31` ? clock.now().getFullYear() + 1 : clock.now().getFullYear();
  const min = minimumFor(settings, year); const amount = parseNairaInput(target); const err = target ? validateTarget(amount, settings, year) : null;
  const finish = (save: boolean) => run(async () => {
    if (save && amount) await repos.member.setTarget(member.id, year, null, amount, true);
    await repos.member.completeOnboarding(member.id); updateMember({ ...member, onboarding: 'Complete' }); onDone?.();
    toast(save && amount ? `Your monthly target is ${formatNaira(amount)}.` : 'You can set a target any time.');
  });
  const newYear = member.onboarding === 'NewYearTarget';
  return <Modal open locked={!newYear} title={newYear ? `Set your ${year} monthly savings target` : 'Set your monthly savings target'} onClose={() => finish(false)}
    footer={<><Button variant="outline" size="md" disabled={busy} onClick={() => finish(false)}>Skip for now</Button><Button size="md" disabled={!amount || !!err || busy} onClick={() => finish(true)}>Set target</Button></>}>
    <p className="text-sm text-mute">{newYear ? '' : 'Step 2 of 2 · '}How much would you like to save each month? We’ll track your progress and remind you. It’s a goal, not a rule: each payment just needs to be at least {formatNaira(min)}.</p>
    <TextField label="Monthly savings target" inputMode="numeric" value={target} onChange={e => setTarget(e.target.value.replace(/\D/g, ''))} placeholder="25000" error={err ?? undefined} hint="You can change it any time, for any month." />
    <div className="flex flex-wrap gap-2">{[10_000, 20_000, 30_000, 50_000].map(v => <Button key={v} variant={amount === naira(v) ? 'dark' : 'outline'} size="sm" onClick={() => setTarget(String(v))}>{formatNaira(naira(v))}</Button>)}</div>
    {!newYear && <Banner icon={<Users size={20} />}><b>Next: your first payment.</b> The WhatsApp community unlocks once your first payment of at least {formatNaira(min)} is confirmed.</Banner>}
  </Modal>;
}
