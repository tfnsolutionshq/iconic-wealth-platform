import type { ApiMemberStatus } from "@/domain/repositories";
import type { Tone } from "../../design-system/components/Feedback";

/** Display copy for every account status returned by GET /admin/members. */
export const MEMBER_STATUS_LABEL: Record<ApiMemberStatus, string> = {
  pending_email_verification: "Pending email verification",
  pending_profile_completion: "Pending profile completion",
  pending_approval: "Pending admin approval",
  active: "Active",
  rejected: "Rejected",
  suspended: "Suspended",
};

export const MEMBER_STATUS_TONE: Record<ApiMemberStatus, Tone> = {
  pending_email_verification: "mute",
  pending_profile_completion: "gold",
  pending_approval: "pending",
  active: "ok",
  rejected: "fail",
  suspended: "fail",
};

/** The status values accepted by GET /admin/members?status=. */
export const MEMBER_STATUS_VALUES: readonly ApiMemberStatus[] = [
  "pending_email_verification",
  "pending_profile_completion",
  "pending_approval",
  "active",
  "rejected",
  "suspended",
];

export const isMemberStatus = (value: string): value is ApiMemberStatus =>
  (MEMBER_STATUS_VALUES as readonly string[]).includes(value);

/** Older mock rows use title-case Active/Suspended, so normalise before lookup. */
const statusKey = (status: string): ApiMemberStatus | undefined => {
  const key = status.toLowerCase();
  return isMemberStatus(key) ? key : undefined;
};

export const memberStatusLabel = (status: string): string => {
  const key = statusKey(status);
  return key ? MEMBER_STATUS_LABEL[key] : status;
};

export const memberStatusTone = (status: string): Tone => {
  const key = statusKey(status);
  return key ? MEMBER_STATUS_TONE[key] : "mute";
};
