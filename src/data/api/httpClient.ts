/** Thin fetch wrapper. Auth token is sent as a Bearer header; errors are normalised to Error(message). */
export class HttpClient {
  constructor(private readonly baseUrl: string, private readonly getToken: () => string | null) {}
  async request<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const token = this.getToken();
    const res = await fetch(this.baseUrl + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), credentials: 'include',
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})) as { message?: string }; throw new Error(err.message || `Request failed (${res.status})`); }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }
  get<T>(p: string) { return this.request<T>('GET', p); }
  post<T>(p: string, b?: unknown) { return this.request<T>('POST', p, b); }
  put<T>(p: string, b?: unknown) { return this.request<T>('PUT', p, b); }
}
