export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  paystackPublicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '',
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
  waCommunityUrl: import.meta.env.VITE_WA_COMMUNITY_URL || '#',
  waSupportUrl: import.meta.env.VITE_WA_SUPPORT_URL || '#',
} as const;
