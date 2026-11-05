/** Field-level errors returned by POST /auth/login, ready for the login form. */
export interface LoginErrors {
  login?: string;
  password?: string;
  /** Anything that does not belong to a specific field (network, server or unknown keys). */
  form?: string;
}

/**
 * Converts the API validation envelope's `errors` object into the login form's
 * fields. `{ login: ["The provided credentials are incorrect."] }` is shown under
 * the email/phone input instead of as a generic banner or password error.
 */
export function mapLoginErrors(
  errors: Record<string, string[]>,
): LoginErrors {
  const out: LoginErrors = {};
  const form: string[] = [];
  for (const [apiField, value] of Object.entries(errors)) {
    const message = (Array.isArray(value) ? value : [value])
      .filter(Boolean)
      .join(' ');
    if (!message) continue;
    if (apiField === 'login' || apiField === 'password') {
      out[apiField] = out[apiField] ? `${out[apiField]} ${message}` : message;
    } else {
      form.push(message);
    }
  }
  if (form.length) out.form = form.join(' ');
  return out;
}
