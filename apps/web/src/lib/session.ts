import { apiUrl } from "./config.js";

const SESSION_KEY = "baba_session_id";

export function getStoredSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function storeSessionId(id: string): void {
  localStorage.setItem(SESSION_KEY, id);
}

/** Garante um sessionId anonimo, criando-o no backend se necessario. */
export async function ensureSessionId(): Promise<string> {
  const existing = getStoredSessionId();
  if (existing) return existing;

  const res = await fetch(apiUrl("/api/session"), { method: "POST" });
  const data = (await res.json()) as { sessionId: string };
  storeSessionId(data.sessionId);
  return data.sessionId;
}
