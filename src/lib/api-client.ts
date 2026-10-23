// Small fetch wrapper for UI code. Every API route answers errors as { error: "message" }.

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? "Something went wrong. Please try again.");
  }
  return data as T;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

/** POST / PATCH a JSON body (or no body) and return the parsed answer. */
export function sendJson<T>(url: string, body?: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  return apiFetch<T>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
