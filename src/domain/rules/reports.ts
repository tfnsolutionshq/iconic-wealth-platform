import type { AdminReportKey } from "@/domain/entities";

/** Prototype report order and the headers used when an API returns bare rows. */
export const ADMIN_REPORT_KEYS: AdminReportKey[] = [
  "compliance",
  "eligibility",
  "charges",
  "payout",
  "late",
  "savings",
];

export const REPORT_HEADERS: Record<AdminReportKey, string[]> = {
  compliance: ["Member ID", "Member", "Month", "Status"],
  eligibility: ["Member ID", "Member", "Eligibility", "Reason"],
  charges: [
    "Date",
    "Member",
    "Contribution",
    "Platform charge",
    "Total paid",
    "Status",
  ],
  payout: ["Member ID", "Member", "Savings", "Interest", "Payout", "Status"],
  late: ["Member ID", "Member", "For", "Paid on", "Impact"],
  savings: [
    "Member ID",
    "Member",
    "Monthly target",
    "Months saved",
    "Saved",
    "September",
  ],
};

/** Status chips shown for each report in the reference build. */
export const REPORT_STATUS_OPTIONS: Record<AdminReportKey, string[]> = {
  compliance: ["All", "Paid", "Due", "Late", "Missed", "Not due"],
  eligibility: ["All", "Eligible", "Forfeited"],
  charges: ["All", "Successful", "Pending", "Failed"],
  payout: ["All", "Paid", "Failed", "Pending"],
  late: ["All"],
  savings: ["All", "Paid", "Due", "Late", "Missed"],
};
