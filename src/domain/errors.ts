/**
 * A failed request that carries per-field validation messages from the API.
 * Presentation code can map these onto form fields without knowing about the HTTP layer.
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    readonly fields: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * The API rejected the request because the caller is not authenticated (HTTP 401).
 * Registration uses this when the email-verification token is missing or has expired,
 * so the page can send the member back through verification instead of showing the
 * raw "Unauthenticated." message.
 */
export class UnauthorizedError extends Error {
  constructor(message = 'Your email verification has expired. Please verify your email again.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
