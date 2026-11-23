import { COMMUNITY_GUIDELINES } from "../../website/content/communityGuidelines";

/** Community Operational Guidelines (used as Terms & Conditions during registration) and privacy policy. */
export const POLICIES = {
  guidelines: {
    title: COMMUNITY_GUIDELINES.title,
    lead: `${COMMUNITY_GUIDELINES.greeting} ${COMMUNITY_GUIDELINES.intro.join(" ")}`,
    items: [
      ...COMMUNITY_GUIDELINES.overview.map(
        (entry) => [entry.title, entry.body] as const,
      ),
      ...COMMUNITY_GUIDELINES.keyGuidelines.map(
        (entry) => [entry.title, entry.body] as const,
      ),
      ["Important Reminder", COMMUNITY_GUIDELINES.importantReminder] as const,
      [
        "Getting started",
        `${COMMUNITY_GUIDELINES.gettingStarted} Phone/WhatsApp: ${COMMUNITY_GUIDELINES.contact.phone} · Email: ${COMMUNITY_GUIDELINES.contact.email}`,
      ] as const,
    ],
  },
  privacy: { title: 'Privacy policy', lead: 'How we collect, use and protect your personal data, in line with the Nigeria Data Protection Act 2023. Draft for legal review.', items: [
    ['What we collect', 'Name, date of birth, gender, email, phone, state of residence and address, next of kin, payout account, how you heard about us, referrer, and your savings and payment records.'],
    ['Why we use it', 'To manage membership, verify identity, process contributions and payouts, calculate interest, send notices and meet legal and audit duties.'],
    ['Who we share it with', 'Only providers that help run the platform: Paystack, and our email and SMS providers. We never sell your data.'],
    ['How we protect it', 'Encryption in transit and for sensitive fields at rest, role-based access, and an audit log of privileged actions.'],
    ['Your rights', 'Ask to see, correct or delete your data where the law allows, and withdraw consent for optional messages.'],
  ] },
} as const;
export type PolicyKey = keyof typeof POLICIES;
