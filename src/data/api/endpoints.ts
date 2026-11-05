/**
 * Every API path lives here. Repositories pass these relative paths to `HttpClient`,
 * which applies the configured base URL exactly once.
 */
export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    passwordReset: '/auth/password-reset',
  },
  registration: {
    start: '/auth/member/register',
    verifyEmail: '/auth/member/register/verify-email',
    resendEmail: '/auth/member/register/resend-code',
    complete: '/auth/member/register/complete',
  },
} as const;
