/** The server used by every API-backed repository, in development and production. */
export const API_BASE_URL = 'https://api.iconicwealth.tfnsolutions.us/api/v1/';

// An explicit VITE_API_BASE_URL overrides the canonical server for a specific
// environment; an empty value always falls back to the canonical URL.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || API_BASE_URL;

export const env = {
  apiBaseUrl,
  paystackPublicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '',
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
  waCommunityUrl: import.meta.env.VITE_WA_COMMUNITY_URL || '#',
  waSupportUrl: import.meta.env.VITE_WA_SUPPORT_URL || '#',
} as const;
