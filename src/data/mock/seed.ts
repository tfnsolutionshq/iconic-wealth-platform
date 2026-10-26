/** Sample data matching the approved build v5 (names, amounts and dates are fictional). */
import type { AdminListItem, AuditEntry, InterestWorkflow, Member, MemberSummary, MonthIndex, PayoutBatch, PayoutRow, Registration, SavingsYear, Testimonial, Transaction, WalletEntry, WalletWithdrawal } from '@/domain/entities';
import { naira } from '@/domain/rules';

export const DEMO_TODAY = '2026-10-02T09:40:00';

const member = (id: string, first: string, last: string, extra: Partial<Member>): Member => ({ id, firstName: first, lastName: last, gender: 'Female', dateOfBirth: '1990-01-01', email: '', phone: '',
  stateOfResidence: 'Lagos', address: '', nextOfKin: { name: '', relationship: 'Spouse', phone: '' }, status: 'Active', joinedOn: '2026-01-01', community: 'Granted', onboarding: 'Complete', ...extra });

export const members: Member[] = [
  member('IWH-00412', 'Funmilayo', 'Adebayo', { dateOfBirth: '1988-04-14', email: 'funmi.adebayo@mail.com', phone: '+234 803 555 4412', address: '14 Adeola Odeku St, Victoria Island',
    nextOfKin: { name: 'Tunde Adebayo', relationship: 'Spouse', phone: '0803 555 0198' }, joinedOn: '2025-01-14', referredBy: 'Chidi Eze',
    payoutAccount: { bankCode: '058', bankName: 'GTBank', accountNumber: '0123456789', accountName: 'FUNMILAYO ADEBAYO' } }),
  /* approved 2 Oct 2026, after the September cut-off → savings start January 2027 */
  member('IWH-01250', 'Ada', 'Okonkwo', { dateOfBirth: '1995-07-22', email: 'ada.okonkwo@mail.com', phone: '+234 802 117 3390', address: '7 Bode Thomas St, Surulere',
    nextOfKin: { name: 'Chinedu Okonkwo', relationship: 'Brother', phone: '0803 221 9087' }, joinedOn: '2026-10-02', community: 'Locked', onboarding: 'PayoutAccount' }),
  /* approved 28 Sep 2026, within the cut-off → catch-up January–August first */
  member('IWH-01244', 'Chiamaka', 'Obi', { dateOfBirth: '1992-11-03', email: 'chiamaka.obi@mail.com', phone: '+234 809 113 5520', stateOfResidence: 'Enugu', address: '4 Ogui Road',
    nextOfKin: { name: 'Emeka Obi', relationship: 'Spouse', phone: '0809 000 4420' }, joinedOn: '2026-09-28', community: 'Locked',
    payoutAccount: { bankCode: '044', bankName: 'Access Bank', accountNumber: '0044556677', accountName: 'CHIAMAKA OBI' } }),
];

export const savingsYears: SavingsYear[] = [
  { memberId: 'IWH-00412', year: 2026, startMonth: 0, joinMonth: null, target: naira(25_000), targets: {}, locks: {} },
  { memberId: 'IWH-01250', year: 2027, startMonth: 0, joinMonth: null, target: 0, targets: {}, locks: {} },
  { memberId: 'IWH-01244', year: 2026, startMonth: 0, joinMonth: 8, target: naira(15_000), targets: {}, locks: {} },
];

const pay = (month: number, amount: number, at: string, n: number): Transaction => ({ id: `TX${n}`, reference: `IWH-C-XP${(7000 + n * 37).toString(36).toUpperCase()}`, gatewayReference: `T77410${n}93`,
  memberId: 'IWH-00412', memberName: 'Funmilayo Adebayo', kind: 'Contribution', year: 2026, allocations: [{ month: month as MonthIndex, amountKobo: naira(amount) }],
  amountKobo: naira(amount), platformChargeKobo: naira(100), status: 'Successful', late: false, createdAt: at });
/** Several months have more than one payment; September is open with ₦15,000 against a ₦25,000 target. */
const baseTransactions = ([[0, 20_000, '2026-02-04T08:12'], [1, 25_000, '2026-03-02T19:40'], [2, 20_000, '2026-03-20T07:55'], [2, 10_000, '2026-04-04T21:10'], [3, 25_000, '2026-05-03T12:10'],
  [4, 30_000, '2026-06-04T09:31'], [5, 20_000, '2026-06-28T10:00'], [5, 15_000, '2026-07-04T18:22'], [6, 25_000, '2026-08-04T10:02'], [7, 20_000, '2026-08-21T09:00'], [7, 10_000, '2026-09-03T08:42'],
  [8, 15_000, '2026-09-26T13:15']] as const).map(([m, a, d], n) => pay(m, a, d, n)).reverse();

const tx = (id: string, reference: string, memberId: string, memberName: string, kind: Transaction['kind'], year: number, month: number, amount: number,
  status: Transaction['status'], createdAt: string, extra?: Partial<Transaction>): Transaction => ({
  id, reference, gatewayReference: status === 'Pending' ? undefined : `T77${id.replace(/\D/g, '').padStart(5, '0')}93`,
  memberId, memberName, kind, year, allocations: [{ month: month as MonthIndex, amountKobo: naira(amount) }],
  amountKobo: naira(amount), platformChargeKobo: kind === 'Payout' ? 0 : naira(100), status, late: false, createdAt, ...extra,
});

/** Failed, pending, late and payout transactions across members (ADM-14). Failed/pending never count toward savings. */
const extraTransactions: Transaction[] = [
  tx('TX20', 'IWH-C-9Q2MA1', 'IWH-00702', 'Ngozi Obi', 'Contribution', 2026, 8, 20_000, 'Failed', '2026-09-28T14:02:00', { failureReason: 'Declined by bank: insufficient funds' }),
  tx('TX21', 'IWH-C-9Q2MB7', 'IWH-00733', 'Bisola Akande', 'Contribution', 2026, 8, 10_000, 'Pending', '2026-10-02T08:55:00'),
  tx('TX22', 'IWH-C-9P8ZX3', 'IWH-00412', 'Funmilayo Adebayo', 'Contribution', 2026, 7, 25_000, 'Failed', '2026-08-19T10:14:00', { failureReason: 'Card expired' }),
  tx('TX23', 'IWH-C-9Q1KQ9', 'IWH-00291', 'Emeka Nwosu', 'Contribution', 2026, 8, 15_000, 'Successful', '2026-09-30T22:41:00', { late: true }),
  tx('TX24', 'IWH-C-9Q2MD2', 'IWH-00560', 'Halima Bello', 'Contribution', 2026, 8, 25_000, 'Successful', '2026-09-27T09:20:00'),
  tx('TX25', 'IWH-C-9P4TT8', 'IWH-00901', 'Yetunde Fashola', 'Contribution', 2026, 6, 10_000, 'Failed', '2026-07-30T16:05:00', { failureReason: 'Transaction timed out at the bank' }),
  tx('TX26', 'IWH-P-251218-0Q4M', 'IWH-00702', 'Ngozi Obi', 'Payout', 2025, 11, 198_000, 'Successful', '2025-12-18T09:12:00'),
  tx('TX27', 'IWH-P-251218-1R7B', 'IWH-00118', 'Chidi Eze', 'Payout', 2025, 11, 495_000, 'Failed', '2025-12-18T09:12:00', { failureReason: 'Beneficiary account closed' }),
  tx('TX28', 'IWH-P-251218-2S1C', 'IWH-00087', 'Tola Ige', 'Payout', 2025, 11, 297_000, 'Processing', '2025-12-18T09:12:00'),
];

export const transactions: Transaction[] = [...extraTransactions, ...baseTransactions];

/** Member wallet ledgers (demo): top-ups and withdrawals for the primary demo member. Newest first. */
export const walletEntries: WalletEntry[] = [
  { id: 'WE5', reference: 'IWH-W-D7F2K9', memberId: 'IWH-00412', kind: 'Withdrawal', direction: 'Debit', amountKobo: naira(5_000), status: 'Processing', note: 'To GTBank •••• 6789', createdAt: '2026-10-01T14:30:00' },
  { id: 'WE4', reference: 'IWH-W-C4R8N1', memberId: 'IWH-00412', kind: 'Withdrawal', direction: 'Debit', amountKobo: naira(15_000), status: 'Successful', note: 'To GTBank •••• 6789', createdAt: '2026-09-20T11:05:00' },
  { id: 'WE3', reference: 'IWH-W-9VX3M8', memberId: 'IWH-00412', kind: 'TopUp', direction: 'Credit', amountKobo: naira(25_000), status: 'Successful', createdAt: '2026-09-10T09:15:00' },
  { id: 'WE2', reference: 'IWH-W-9TQ7B2', memberId: 'IWH-00412', kind: 'TopUp', direction: 'Credit', amountKobo: naira(10_000), status: 'Failed', failureReason: 'Payment abandoned at checkout', createdAt: '2026-09-05T18:03:00' },
  { id: 'WE1', reference: 'IWH-W-8K2P4D', memberId: 'IWH-00412', kind: 'TopUp', direction: 'Credit', amountKobo: naira(30_000), status: 'Successful', createdAt: '2026-08-15T10:20:00' },
];

export const walletWithdrawals: WalletWithdrawal[] = [
  { id: 'WR2', reference: 'IWH-W-D7F2K9', memberId: 'IWH-00412', amountKobo: naira(5_000), status: 'Processing', bankName: 'GTBank', accountNumber: '0123456789', accountName: 'FUNMILAYO ADEBAYO', createdAt: '2026-10-01T14:30:00' },
  { id: 'WR1', reference: 'IWH-W-C4R8N1', memberId: 'IWH-00412', amountKobo: naira(15_000), status: 'Paid', bankName: 'GTBank', accountNumber: '0123456789', accountName: 'FUNMILAYO ADEBAYO', createdAt: '2026-09-20T11:05:00' },
];

export const testimonials: Testimonial[] = [
  { id: 'T1', name: 'Ngozi O.', descriptor: 'Member since 2023 · Lagos', quote: 'Saving every month used to be a resolution I broke by March. With the reminders and the community, I saved all eleven months.', status: 'Published', order: 1 },
  { id: 'T2', name: 'Halima B.', descriptor: 'Member since 2024 · Abuja', quote: 'I can pay more in a good month and still see exactly where every naira went. The payout came in before the 14th.', status: 'Published', order: 2 },
  { id: 'T3', name: 'Bisola A.', descriptor: 'Member since 2025 · Awka', quote: 'The monthly target keeps me honest. Meeting it and seeing my streak grow is genuinely motivating.', status: 'Published', order: 3 },
  { id: 'T4', name: 'Tola I.', descriptor: 'Member since 2023 · Ibadan', quote: 'A community of women who take saving seriously. It changed how I plan my year.', status: 'Published', order: 4 },
  { id: 'T5', name: 'Funke A.', descriptor: 'Member since 2026 · Lagos', quote: 'I joined late in the year and the catch-up plan made it easy to start properly.', status: 'Draft', order: 5 },
];

/** Registrations awaiting review (ADM-12). Sample data matching the approved build (names and dates are fictional). */
const reg = (id: string, first: string, last: string, extra: Partial<Registration>): Registration => ({ id, firstName: first, lastName: last, gender: 'Female', dateOfBirth: '1990-01-01',
  email: '', phone: '', stateOfResidence: 'Lagos', address: '', heardAboutUs: 'A member referred me', nextOfKin: { name: '', relationship: 'Spouse', phone: '' },
  submittedAt: '2026-09-01T09:00:00', status: 'New', ...extra });

export const registrations: Registration[] = [
  reg('R-1042', 'Folake', 'Ogunleye', { dateOfBirth: '1991-03-18', email: 'folake.o@mail.com', phone: '+234 805 321 7781', address: '15 Allen Avenue, Ikeja',
    referredBy: 'Chidi Eze', nextOfKin: { name: 'Bayo Ogunleye', relationship: 'Spouse', phone: '0803 000 1111' }, submittedAt: '2026-10-02T08:12:00', status: 'New' }),
  reg('R-1041', 'Zainab', 'Danjuma', { dateOfBirth: '1989-07-25', email: 'zainab.d@mail.com', phone: '+234 806 778 1290', address: '4 Commercial Road, Yaba',
    heardAboutUs: 'Advert', referredBy: undefined, nextOfKin: { name: 'Musa Danjuma', relationship: 'Father', phone: '0806 000 2222' }, submittedAt: '2026-10-01T17:40:00', status: 'New' }),
  reg('R-1040', 'Grace', 'Eke', { dateOfBirth: '1993-11-02', email: 'grace.eke@mail.com', phone: '+234 803 909 1182', address: '22 Admiralty Way, Lekki',
    referredBy: 'Tola Ige', nextOfKin: { name: 'Ifeanyi Eke', relationship: 'Brother', phone: '0803 000 3333' }, submittedAt: '2026-09-28T11:03:00', status: 'Approved', memberId: 'IWH-01241' }),
  reg('R-1039', 'Ifeoma', 'Okeke', { dateOfBirth: '1990-05-30', email: 'ifeoma.k@mail.com', phone: '+234 809 113 4420', address: '8 Adeniran Ogunsanya St, Surulere',
    heardAboutUs: 'Social media', referredBy: undefined, nextOfKin: { name: 'Obi Okeke', relationship: 'Spouse', phone: '0809 000 4444' }, submittedAt: '2026-09-30T10:20:00', status: 'New' }),
  reg('R-1038', 'Mariam', 'Lawal', { dateOfBirth: '1987-12-11', email: 'mariam.l@mail.com', phone: '+234 802 556 0912', address: '3 Chevron Drive, Ajah',
    referredBy: 'Aisha Musa', nextOfKin: { name: 'Sani Lawal', relationship: 'Brother', phone: '0802 000 5555' }, submittedAt: '2026-09-24T15:44:00', status: 'Approved', memberId: 'IWH-01238' }),
  reg('R-1037', 'Blessing', 'Udo', { dateOfBirth: '1994-02-14', email: 'blessing.udo@mail.com', phone: '+234 701 223 8890', address: '', stateOfResidence: '',
    heardAboutUs: 'Advert', referredBy: undefined, nextOfKin: { name: '', relationship: 'Spouse', phone: '' }, submittedAt: '2026-09-12T09:15:00',
    status: 'Rejected', reason: 'Duplicate of existing member IWH-00702' }),
  reg('R-1036', 'Ronke', 'Alabi', { dateOfBirth: '1992-08-19', email: 'ronke.a@mail.com', phone: '+234 816 440 2231', address: '10 Ikorodu Road, Ikorodu',
    referredBy: 'Halima Bello', nextOfKin: { name: 'Wale Alabi', relationship: 'Spouse', phone: '0816 000 6666' }, submittedAt: '2026-08-29T13:00:00', status: 'New' }),
];

export const memberSummaries: MemberSummary[] = [
  ['IWH-00412', 'Funmilayo Adebayo', 'Active', 25000, 235000, 8, 'Open', 'Eligible', '', 'Chidi Eze', '2025-01-14'],
  ['IWH-00118', 'Chidi Eze', 'Active', 50000, 450000, 9, 'Paid', 'Eligible', '', '', '2024-03-02'],
  ['IWH-00733', 'Bisola Akande', 'Active', 10000, 90000, 9, 'Paid', 'Eligible', '', 'Chidi Eze', '2025-03-11'],
  ['IWH-00291', 'Emeka Nwosu', 'Active', 15000, 105000, 7, 'Open', 'Forfeited', 'August closed with nothing saved', '', '2024-06-20'],
  ['IWH-00560', 'Halima Bello', 'Active', 25000, 200000, 8, 'Open', 'Eligible', '', 'Tola Ige', '2024-09-01'],
  ['IWH-00087', 'Tola Ige', 'Active', 30000, 270000, 9, 'Locked', 'Eligible', '', '', '2023-11-15'],
  ['IWH-00644', 'Kunle Ojo', 'Active', 10000, 80000, 8, 'Open', 'Forfeited', 'July closed with nothing saved', '', '2025-05-30'],
  ['IWH-00702', 'Ngozi Obi', 'Active', 20000, 180000, 9, 'Paid', 'Eligible', '', 'Bisola Akande', '2025-02-07'],
  ['IWH-00901', 'Yetunde Fashola', 'Suspended', 10000, 60000, 6, 'Missed', 'Forfeited', 'July and August closed with nothing saved', '', '2025-04-22'],
].map(r => ({ id: r[0] as string, name: r[1] as string, status: r[2] as MemberSummary['status'], targetKobo: naira(r[3] as number), savedKobo: naira(r[4] as number), monthsPaid: r[5] as number,
  currentMonthStatus: r[6] as MemberSummary['currentMonthStatus'], eligibility: r[7] as MemberSummary['eligibility'], forfeitReason: (r[8] as string) || undefined, referredBy: (r[9] as string) || undefined, joinedOn: r[10] as string }));

/** Interest configurations, one per savings year (ADM-15). 2024/2025 are closed and read-only; 2026 runs the 8-stage workflow. */
export const interestYears: InterestWorkflow[] = [
  { year: 2024, status: 'Paid out', rate: 9, rateMode: 'Fixed rate', eligible: 812, forfeited: 61, contributionsKobo: naira(168_200_000), interestKobo: naira(15_138_000),
    maker: 'Adaeze Okafor', checker: 'Olumide Bakare', approvedAt: '2024-12-12', batchId: 'PB-2024-12',
    closed: true, stage: 8, done: 8, start: '2024-01-01', end: '2024-11-30', close: '2025-01-05', rounding: 'Nearest naira', bands: [], scope: 'All members', selectedMemberIds: [], excludedMemberIds: [], calc: true, note: '', notified: true,
    history: [['2024-12-10T09:00', 'Submitted for approval', 'Adaeze Okafor'], ['2024-12-12T14:20', 'Approved configuration', 'Olumide Bakare'], ['2024-12-17T15:30', '845 paid · batch completed', 'System']] },
  { year: 2025, status: 'Paid out', rate: 10, rateMode: 'Fixed rate', eligible: 961, forfeited: 71, contributionsKobo: naira(216_400_000), interestKobo: naira(21_640_000),
    maker: 'Adaeze Okafor', checker: 'Olumide Bakare', approvedAt: '2025-12-13', batchId: 'PB-2025-12',
    closed: true, stage: 8, done: 8, start: '2025-01-01', end: '2025-11-30', close: '2026-01-05', rounding: 'Nearest naira', bands: [], scope: 'All members', selectedMemberIds: [], excludedMemberIds: [], calc: true, note: '', notified: true,
    history: [['2025-12-11T10:00', 'Submitted for approval', 'Adaeze Okafor'], ['2025-12-13T11:45', 'Approved configuration', 'Olumide Bakare'], ['2025-12-18T11:40', '1,029 paid · 3 failed', 'System']] },
  { year: 2026, status: 'Not started', rate: null, rateMode: 'Fixed rate', eligible: 0, forfeited: 0, contributionsKobo: 0, interestKobo: 0,
    closed: false, stage: 1, done: 0, start: '2026-01-01', end: '2026-11-30', close: '2027-01-05', rounding: 'Nearest naira', bands: [], scope: 'All members', selectedMemberIds: [], excludedMemberIds: [], calc: false, note: '', notified: false, history: [] },
];

const prow = (memberId: string, memberName: string, saved: number, ratePct: number, account: string, status: PayoutRow['status'], reference: string, reason?: string): PayoutRow => {
  const savingsKobo = naira(saved), interestKobo = Math.round(saved * ratePct / 100) * 100;
  return { memberId, memberName, savingsKobo, interestKobo, totalKobo: savingsKobo + interestKobo, account, status, reference, reason };
};
const sampleRows = (ratePct: number, failed: Record<number, string>): PayoutRow[] => {
  const people: [string, string, number, string][] = [
    ['IWH-00412', 'Funmilayo Adebayo', 235_000, 'GTBank •••• 6789'], ['IWH-00118', 'Chidi Eze', 450_000, 'Access Bank •••• 6677'],
    ['IWH-00733', 'Bisola Akande', 90_000, 'First Bank •••• 1122'], ['IWH-00291', 'Emeka Nwosu', 105_000, 'UBA •••• 3344'],
    ['IWH-00560', 'Halima Bello', 200_000, 'Zenith Bank •••• 5566'], ['IWH-00087', 'Tola Ige', 270_000, 'GTBank •••• 7788'],
    ['IWH-00644', 'Kunle Ojo', 80_000, 'Access Bank •••• 9900'], ['IWH-00702', 'Ngozi Obi', 180_000, 'First Bank •••• 2233'],
    ['IWH-00901', 'Yetunde Fashola', 60_000, 'UBA •••• 4455'], ['IWH-01244', 'Chiamaka Obi', 45_000, 'Access Bank •••• 6677'],
  ];
  return people.map(([mid, name, saved, acct], i) => prow(mid, name, saved, ratePct, acct,
    failed[i] ? 'Failed' : 'Paid', `IWH-P-${ratePct === 10 ? '251218' : '241217'}-${(1000 + i * 37).toString(36).toUpperCase().padStart(4, '0')}`, failed[i]));
};

/** Year-end payout batches (ADM-18). Counts are full-batch; rows are the sample shown. */
export const payoutBatches: PayoutBatch[] = [
  { id: 'PB-2025-12', year: 2025, month: 'December', status: 'Partial', count: 1032, savingsKobo: naira(216_400_000), interestKobo: naira(21_640_000),
    maker: 'Adaeze Okafor', checker: 'Olumide Bakare', createdAt: '2025-12-15T10:00:00',
    rows: sampleRows(10, { 3: 'Beneficiary account closed', 6: 'Account name does not match member name', 8: 'Bank network unavailable' }),
    history: [['2025-12-15T10:00', 'Batch created', 'Adaeze Okafor'], ['2025-12-16T09:12', 'Approved batch', 'Olumide Bakare'],
      ['2025-12-18T08:00', 'Disbursement started', 'System'], ['2025-12-18T11:40', '1,029 paid · 3 failed', 'System']] },
  { id: 'PB-2024-12', year: 2024, month: 'December', status: 'Completed', count: 845, savingsKobo: naira(168_200_000), interestKobo: naira(15_138_000),
    maker: 'Adaeze Okafor', checker: 'Olumide Bakare', createdAt: '2024-12-14T10:00:00', rows: sampleRows(9, {}),
    history: [['2024-12-14T10:00', 'Batch created', 'Adaeze Okafor'], ['2024-12-15T12:00', 'Approved batch', 'Olumide Bakare'],
      ['2024-12-17T15:30', '845 paid · batch completed', 'System']] },
];

/** Audit log seeds (ADM-23). Entries are append-only. */
export const auditEntries: AuditEntry[] = [
  ['2026-09-12T09:30:00', 'Adaeze Okafor', 'Administrator', 'Rejected registration', 'R-1037', 'Duplicate of existing member', 'Members'],
  ['2026-09-20T14:02:00', 'Adaeze Okafor', 'Administrator', 'Marked payout as paid manually', 'IWH-P-251218-0Q4M', 'Proof uploaded', 'Financial'],
  ['2026-09-29T09:15:00', 'Adaeze Okafor', 'Administrator', 'Approved registration', 'IWH-00948', 'Pending → Active', 'Members'],
  ['2026-09-29T18:40:00', 'Olumide Bakare', 'Super Admin', 'Exported report', 'Year-end payout 2025', 'CSV, 1,032 rows', 'Financial'],
  ['2026-09-30T10:12:00', 'Adaeze Okafor', 'Administrator', 'Edited member details', 'IWH-00815', 'Phone number updated', 'Members'],
  ['2026-10-01T11:20:00', 'Olumide Bakare', 'Super Admin', 'Changed role', 'Yemi Fash', 'Viewer → Administrator', 'Roles'],
  ['2026-10-01T16:44:00', 'Adaeze Okafor', 'Administrator', 'Exported members list', 'Members', 'CSV, 1,248 rows', 'Access'],
  ['2026-10-02T09:31:00', 'Adaeze Okafor', 'Administrator', 'Viewed member record', 'IWH-00412', '—', 'Access'],
].map(([at, actor, role, action, entity, change, category], n) => ({ id: `A${n + 1}`, at, actor, role, action, entity, change, category: category as AuditEntry['category'] })).reverse();

/** Admin users (ADM-24). */
export const adminUsers: AdminListItem[] = [
  { id: 'A-1', name: 'Adaeze Okafor', email: 'adaeze@iconicwealthhub.coop', role: 'Administrator', status: 'Active', lastActive: 'Today, 9:31' },
  { id: 'A-2', name: 'Olumide Bakare', email: 'olumide@iconicwealthhub.coop', role: 'SuperAdmin', status: 'Active', lastActive: 'Yesterday, 18:40' },
  { id: 'A-3', name: 'Yemi Fashina', email: 'yemi@iconicwealthhub.coop', role: 'Administrator', status: 'Active', lastActive: '1 Oct, 11:20' },
  { id: 'A-4', name: 'Kemi Ajayi', email: 'kemi@iconicwealthhub.coop', role: 'Administrator', status: 'Deactivated', lastActive: '12 Aug, 10:02' },
];
/** Demo log-in identities (any password works in demo mode). */
export const DEMO_ACCOUNTS = [
  { key: 'existing', label: 'Existing member', identifier: 'funmi.adebayo@mail.com' },
  { key: 'new', label: 'First-time member', identifier: 'ada.okonkwo@mail.com' },
  { key: 'midyear', label: 'Mid-year joiner', identifier: 'chiamaka.obi@mail.com' },
  { key: 'pending', label: 'Awaiting approval', identifier: 'folake.o@mail.com' },
  { key: 'admin', label: 'Administrator', identifier: 'adaeze@iconicwealthhub.coop' },
] as const;
