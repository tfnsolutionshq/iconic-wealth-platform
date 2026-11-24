export interface GuidelineEntry {
  title: string;
  body: string;
}

export const COMMUNITY_GUIDELINES = {
  title: "Community Operational Guidelines",
  greeting: "Greetings, Iconic Wealth Queens.",
  intro: [
    "Iconic Wealth Hub is an exclusive wealth-building community for women committed to developing financial discipline, growing their savings, and working toward their financial goals.",
    "Our focus is simple: save consistently and build wealth together. We encourage accountability and support one another in staying committed to our financial goals.",
    "Please take a few minutes to read and understand these community guidelines.",
  ],
  overview: [
    {
      title: "Our Objectives",
      body: "Our primary objective is to promote a strong savings culture through consistent monthly contributions. Iconic Wealth Hub is not a money-doubling scheme. It is a savings initiative designed to encourage financial discipline. The aim is not to save ₦100,000 and expect ₦200,000 at year-end, but to develop a consistent savings habit while ensuring that our savings are not sitting idle but come back with earnings no matter how small.",
    },
    {
      title: "Are your funds secure?",
      body: "Yes, your funds are secured. Funds are managed through our registered cooperative and trusted financial institutions. Funds may be invested in instruments such as mutual funds, treasury bills, commercial papers, and similar investments to enable us earn when we receive our payout in December. This is our 4th year running and it has been a fantastic journey so far. We remain committed to providing a rewarding savings experience for our members.",
    },
    {
      title: "Your Responsibilities",
      body: "Every member is expected to take this commitment seriously and make the required monthly contributions. Never transfer money to an account other than the official designated account. Management will not be responsible for payments made to unauthorised accounts.",
    },
  ] satisfies GuidelineEntry[],
  keyGuidelines: [
    {
      title: "Savings",
      body: "Our priority is building a consistent savings culture. Any interest earned is an added benefit, not the primary objective. Monthly savings are compulsory and members’ contributions are scheduled to be returned at year-end in accordance with the applicable payout terms.",
    },
    {
      title: "Contributions",
      body: "The minimum monthly contribution is ₦10,000. There is no maximum limit. Members may save according to their financial capacity and increase their contributions whenever they wish.",
    },
    {
      title: "Contribution deadline",
      body: "All monthly contributions must be made on or before the 5th of the following month. For example, January savings must be paid latest 5th February, February savings to be paid latest 5th March, and so on. Any payment received after the deadline will count towards the new month and may disqualify the member from interest distribution for that month.",
    },
    {
      title: "Withdrawals and Payouts",
      body: "No withdrawal is permitted before the end of the savings year. Payouts are scheduled for the second week of December on or before 14 December. Please commit only funds you can afford to leave untouched until the end of the savings cycle.",
    },
    {
      title: "Interest Distribution",
      body: "Interest is not stated, fixed, or guaranteed. Returns may rise or fall depending on market conditions. Where interest is available for distribution, it is shared proportionately based on members’ contributions. Members who contribute consistently throughout the year qualify for interest distribution subject to the applicable payout terms. Missing a monthly contribution may result in forfeiting eligibility for that year’s interest. In that case, the member will receive their contributions at year-end. Members should not expect the same returns from previous years even when their contributions remain unchanged.",
    },
    {
      title: "Savings Pool and Administration",
      body: "Funds may be invested in instruments such as Treasury bills, commercial papers, mutual funds, and similar investment products. A portion of investment income is allocated to administrative expenses and the balance is distributed among eligible members.",
    },
    {
      title: "Your Capital",
      body: "Your contributions remain your principal savings and will never be touched.",
    },
    {
      title: "Privacy",
      body: "Members’ personal information and individual contribution amounts are treated as confidential and will not be disclosed to other members.",
    },
  ] satisfies GuidelineEntry[],
  importantReminder:
    "Iconic Wealth Hub is a savings community, not a money-doubling scheme. Our primary goal is to help women develop financial discipline through consistent savings.",
  gettingStarted:
    "If you agree to these guidelines and are ready to begin your wealth-building journey, please complete the registration form and make your initial contribution.",
  contact: {
    phone: "+234 816 592 7232",
    email: "iconicwealth2026@gmail.com",
  },
  signoff:
    "Be an Iconic Wealth Queen today. Together, we save, invest, and build wealth.",
  tagline: "Where Women Build and Multiply Wealth together.",
  closing: "The Future Is Iconic. Are You?",
} as const;
