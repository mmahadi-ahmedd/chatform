/** Small fetch wrapper for the browser: always returns {ok, data, error}, never throws. */
export async function api<T = any>(
  url: string,
  init: Omit<RequestInit, "body"> & { json?: unknown } = {}
): Promise<{ ok: boolean; status: number; data: T; error?: string }> {
  try {
    const { json, ...rest } = init;
    const res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: res.status, data };
    const fallback =
      res.status === 401 ? "Your session expired. Please sign in again." : res.status === 429 ? "Too many requests. Please wait a moment." : "Something went wrong. Please try again.";
    return { ok: false, status: res.status, data, error: data?.error || fallback };
  } catch {
    return { ok: false, status: 0, data: {} as T, error: "Network error. Check your connection and try again." };
  }
}
