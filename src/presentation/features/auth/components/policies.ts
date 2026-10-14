/** Savings guidelines (Iconic Wealth Hub's operational guidelines, v5) and privacy policy (DRAFT for legal review). */
export const POLICIES = {
  guidelines: { title: 'Savings guidelines', lead: 'How saving with Iconic Wealth Hub works. By joining, you agree to save under these guidelines.', items: [
    ['Who can join', 'Membership is open to women aged 18 and above who register online, verify their email and are approved by an admin.'],
    ['Savings months', 'The savings year runs from January to November. December is the payout month.'],
    ['Minimum payment', 'Each payment must be at least ₦10,000 (set each year by Iconic Wealth Hub). Save more, as often as you like.'],
    ['Monthly target', 'You may set a monthly savings target. It helps you track progress and is never enforced.'],
    ['How months close', 'A month opens on the 1st and closes at the end of the 5th of the next month. With at least ₦10,000 saved you may lock it early; later payments then count toward the next month.'],
    ['Missed months', 'If a month closes with nothing saved, it is recorded as missed and may affect your interest for that year. Your savings are never affected.'],
    ['Joining mid-year', 'Members approved by the end of September clear the earlier months as catch-up (₦10,000 each). Members approved after September start the next January.'],
    ['Charges', 'A ₦100 platform charge applies to each payment and is shown in the total before you pay.'],
    ['Community access', 'The members’ WhatsApp community is available after your first confirmed payment of at least ₦10,000.'],
    ['Payout', 'Savings, with any interest due, are paid out in full on or before 14 December. Early or partial withdrawals are not available.'],
  ] },
  privacy: { title: 'Privacy policy', lead: 'How we collect, use and protect your personal data, in line with the Nigeria Data Protection Act 2023. Draft for legal review.', items: [
    ['What we collect', 'Name, date of birth, gender, email, phone, state of residence and address, next of kin, payout account, how you heard about us, referrer, and your savings and payment records.'],
    ['Why we use it', 'To manage membership, verify identity, process contributions and payouts, calculate interest, send notices and meet legal and audit duties.'],
    ['Who we share it with', 'Only providers that help run the platform: Paystack, and our email and SMS providers. We never sell your data.'],
    ['How we protect it', 'Encryption in transit and for sensitive fields at rest, role-based access, and an audit log of privileged actions.'],
    ['Your rights', 'Ask to see, correct or delete your data where the law allows, and withdraw consent for optional messages.'],
  ] },
} as const;
export type PolicyKey = keyof typeof POLICIES;
