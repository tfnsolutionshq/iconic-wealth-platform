import { ageOn } from './calendar';

export const NG_STATES = ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'] as const;
export const HEARD_OPTIONS = ['A member referred me', 'Social media', 'Advert', 'Church or event', 'Friend or family (not a member)', 'Other'] as const;
export const REFERRAL_OPTION = HEARD_OPTIONS[0];
export const MIN_AGE = 18; // assumption, pending client confirmation

export interface RegistrationDetails {
  firstName: string; lastName: string; dateOfBirth: string; email: string; phone: string;
  stateOfResidence: string; address: string; heardAboutUs: string; referredBy: string;
}
export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v);
export const isPhone = (v: string) => v.replace(/\D/g, '').length >= 11;

/** Register step 1 (WEB-09). */
export function validateDetails(d: RegistrationDetails, today: Date): FieldErrors<RegistrationDetails> {
  const e: FieldErrors<RegistrationDetails> = {};
  if (!d.firstName.trim()) e.firstName = 'Enter your first name.';
  if (!d.lastName.trim()) e.lastName = 'Enter your last name.';
  if (!d.dateOfBirth) e.dateOfBirth = 'Enter your date of birth.';
  else if (ageOn(d.dateOfBirth, today) < MIN_AGE) e.dateOfBirth = `You must be ${MIN_AGE} or older to join.`;
  if (!isEmail(d.email)) e.email = 'Enter a valid email address.';
  if (!isPhone(d.phone)) e.phone = 'Enter an 11-digit phone number.';
  if (!(NG_STATES as readonly string[]).includes(d.stateOfResidence)) e.stateOfResidence = 'Select your state of residence.';
  if (d.address.trim().length < 5) e.address = 'Enter your residential address.';
  if (!d.heardAboutUs) e.heardAboutUs = 'Tell us how you heard about us.';
  else if (d.heardAboutUs === REFERRAL_OPTION && !d.referredBy.trim()) e.referredBy = 'Enter the member ID or phone number of the person who referred you.';
  return e;
}

/** Password rules used by the "Create your password" modal. */
export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'Upper and lower case letters', test: p => /[A-Z]/.test(p) && /[a-z]/.test(p) },
  { label: 'At least one number', test: p => /\d/.test(p) },
];
export const isStrongPassword = (p: string) => PASSWORD_RULES.every(r => r.test(p));
