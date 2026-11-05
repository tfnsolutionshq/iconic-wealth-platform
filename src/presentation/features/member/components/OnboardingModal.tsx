import { useEffect, useState } from 'react';
import { Lock, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useServices } from '../../../contexts/ServicesContext';
import { useToast } from '../../../contexts/ToastContext';
import { Banner, Button, Modal, SelectField, TextField } from '../../../design-system';
import type { Bank } from '@/domain/entities';
import { DEFAULT_SETTINGS, formatNaira, minimumFor, naira, parseNairaInput, validateTarget } from '@/domain/rules';

/**
 * First-login setup (v5): payout account (required) → monthly savings target (optional).
 * The WhatsApp community is NOT part of onboarding: it unlocks after the first confirmed payment.
 */
export function OnboardingModal({ onDone }: { onDone?: () => void }) {
  const { session, updateMember } = useAuth(); const { repos, clock } = useServices(); const toast = useToast();
  const member = session?.kind === 'member' ? session.member : null;
  const [bank, setBank] = useState(''); const [acct, setAcct] = useState(''); const [acctName, setAcctName] = useState(''); const [target, setTarget] = useState(''); const [busy, setBusy] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]); const [banksError, setBanksError] = useState('');
  const [banksLoading, setBanksLoading] = useState(false); const [banksAttempt, setBanksAttempt] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  useEffect(() => { repos.settings.get().then(setSettings); }, [repos]);
  useEffect(() => {
    if (member?.onboarding !== 'PayoutAccount') return;
    let cancelled = false;
    setBanksLoading(true); setBanksError('');
    repos.payout.listBanks()
      .then(list => { if (!cancelled) { setBanks(list); setBanksLoading(false); } })
      .catch((e: Error) => { if (!cancelled) { setBanksLoading(false); setBanksError(e.message || 'We couldn’t load the bank list.'); } });
    return () => { cancelled = true; };
  }, [repos, member?.onboarding, banksAttempt]);
  useEffect(() => {
    if (acct.length !== 10 || !bank) { setAcctName(''); return; }
    let cancelled = false;
    repos.payout.resolveAccountName(bank, acct)
      .then(name => { if (!cancelled) setAcctName(name); })
      .catch(() => { if (!cancelled) setAcctName(''); });
    return () => { cancelled = true; };
  }, [acct, bank, repos]);
  if (!member || member.isProfileComplete || member.onboarding === 'Complete') return null;
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast((e as Error).message); } finally { setBusy(false); } };

  if (member.onboarding === 'PayoutAccount') {
    const bankName = banks.find(b => b.code === bank)?.name ?? '';
    return <Modal open locked title="Set up your payout details" onClose={() => {}}
      footer={<Button full disabled={!bankName || acct.length !== 10 || busy} onClick={() => run(async () => {
        const payoutAccount = await repos.payout.savePayoutAccount(member.id, { bankCode: bank, bankName, accountNumber: acct });
        updateMember({ ...member, payoutAccount, onboarding: 'Target' }); toast('Payout details saved.'); })}>Save and continue</Button>}>
      <p className="text-sm text-mute">Step 1 of 2 · Your savings and any interest are paid to this account on payout day. Required before you can save.</p>
      <SelectField label="Bank" value={bank} onChange={e => setBank(e.target.value)} options={banks.map(b => ({ value: b.code, label: b.name }))}
        placeholder={banks.length ? 'Select your bank' : banksError ? 'Banks unavailable' : 'Loading banks…'} disabled={!banks.length || banksLoading} error={banksError || undefined} />
      {banksError && (
        <Button variant="outline" size="sm" className="self-start" disabled={banksLoading} icon={<RefreshCw size={14} />}
          onClick={() => setBanksAttempt(n => n + 1)}>{banksLoading ? 'Retrying…' : 'Retry loading banks'}</Button>
      )}
      <TextField label="Account number" inputMode="numeric" value={acct} onChange={e => setAcct(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit account number"
        hint={acctName ? <span className="font-extrabold text-ok">✓ {acctName}</span> : 'We’ll check the account name matches yours.'} />
      <Banner tone="neutral" icon={<Lock size={20} />}>After this, changes to your payout account go through Iconic Wealth Hub for your protection.</Banner>
    </Modal>;
  }

  const year = member.joinedOn > `${clock.now().getFullYear()}-${String(settings.cutoffMonth + 1).padStart(2, '0')}-31` ? clock.now().getFullYear() + 1 : clock.now().getFullYear();
  const min = minimumFor(settings, year); const amount = parseNairaInput(target); const err = target ? validateTarget(amount, settings, year) : null;
  const finish = (save: boolean) => run(async () => {
    if (save && amount) await repos.savingsTarget.setTarget(member.id, year, amount);
    // Dismiss first: a failed onboarding-sync request must not trap the member in the modal.
    updateMember({ ...member, onboarding: 'Complete' }); onDone?.();
    toast(save && amount ? `Your monthly target is ${formatNaira(amount)}.` : 'You can set a target any time.');
    try { await repos.member.completeOnboarding(member.id); } catch { /* The local session is already complete. */ }
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
