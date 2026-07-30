import { useEffect, useState } from "react";
import { ensureSessionId } from "../lib/session.js";

export function useSession(): string | null {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    ensureSessionId().then(setSessionId).catch(() => setSessionId(null));
  }, []);

  return sessionId;
}
