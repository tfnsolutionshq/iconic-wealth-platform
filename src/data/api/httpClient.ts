/** The API wraps every response in this envelope. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: Record<string, string[]> | null;
  meta: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: Record<string, string[]> = {},
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function normalizeErrors(errors: unknown): Record<string, string[]> {
  if (!errors || typeof errors !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [field, value] of Object.entries(
    errors as Record<string, unknown>,
  )) {
    if (typeof value === "string") out[field] = [value];
    else if (Array.isArray(value))
      out[field] = value.map(String).filter(Boolean);
  }
  return out;
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status >= 500)
    return "The server is unavailable right now. Please try again.";
  return `Request failed (${status}).`;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Thin fetch wrapper. The configured base URL is applied here once, so repositories only ever
 * declare relative endpoint paths. Auth token is sent as a Bearer header; API errors are
 * normalised to `ApiError` so the layer above can read field-level validation errors.
 */
export class HttpClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly getToken: () => string | null,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = this.getToken();
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
      });
    } catch {
      throw new ApiError(
        "We couldn’t reach the server. Check your connection and try again.",
        0,
      );
    }

    const text = await res.text();
    let payload: unknown;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!res.ok) {
      const envelope = payload as
        | Partial<ApiEnvelope<unknown>>
        | null
        | undefined;
      throw new ApiError(
        envelope?.message || fallbackMessage(res.status),
        res.status,
        normalizeErrors(envelope?.errors),
        payload,
      );
    }

    // A 200 response can still report a failed operation.
    if (
      payload &&
      typeof payload === "object" &&
      (payload as { success?: unknown }).success === false
    ) {
      const envelope = payload as ApiEnvelope<unknown>;
      throw new ApiError(
        envelope.message || "The request could not be completed.",
        res.status,
        normalizeErrors(envelope.errors),
        payload,
      );
    }

    return (
      res.status === 204 || payload === undefined ? undefined : payload
    ) as T;
  }

  get<T>(path: string) {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, body);
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body);
  }

  delete<T>(path: string) {
    return this.request<T>("DELETE", path);
  }
}
