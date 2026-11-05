export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  // Lets registration and sign-in talk to the live API while the rest of the app stays on mock data.
  // Falls back to the global API base URL when one is configured.
  registrationApiBaseUrl:
    import.meta.env.VITE_REGISTRATION_API_BASE_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    '',
  paystackPublicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '',
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
  waCommunityUrl: import.meta.env.VITE_WA_COMMUNITY_URL || '#',
  waSupportUrl: import.meta.env.VITE_WA_SUPPORT_URL || '#',
} as const;
