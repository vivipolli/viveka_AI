import type { ChatMessage, Conversation, SourceReference } from "shared";
import { query } from "../client.js";

export async function ensureSession(sessionId?: string): Promise<string> {
  if (sessionId) {
    const existing = await query(`SELECT id FROM sessions WHERE id = $1`, [sessionId]);
    if (existing.rowCount && existing.rowCount > 0) return sessionId;
  }
  const created = await query<{ id: string }>(
    `INSERT INTO sessions DEFAULT VALUES RETURNING id`,
  );
  return created.rows[0].id;
}

export async function createConversation(
  sessionId: string,
  title: string,
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO conversations (session_id, title) VALUES ($1, $2) RETURNING id`,
    [sessionId, title.slice(0, 120)],
  );
  return result.rows[0].id;
}

export async function listConversations(
  sessionId: string,
): Promise<Conversation[]> {
  const result = await query<{ id: string; title: string; created_at: Date }>(
    `SELECT id, title, created_at
     FROM conversations
     WHERE session_id = $1
     ORDER BY created_at DESC`,
    [sessionId],
  );
  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function listMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const result = await query<{
    id: string;
    role: "user" | "assistant";
    content: string;
    sources: SourceReference[] | null;
    reading_suggestion: string | null;
    created_at: Date;
  }>(
    `SELECT id, role, content, sources, reading_suggestion, created_at
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId],
  );
  return result.rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    sources: r.sources ?? undefined,
    readingSuggestion: r.reading_suggestion ?? undefined,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function addMessage(params: {
  id?: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceReference[];
  readingSuggestion?: string;
}): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO messages (id, conversation_id, role, content, sources, reading_suggestion)
     VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6) RETURNING id`,
    [
      params.id ?? null,
      params.conversationId,
      params.role,
      params.content,
      params.sources ? JSON.stringify(params.sources) : null,
      params.readingSuggestion ?? null,
    ],
  );
  return result.rows[0].id;
}

export async function conversationBelongsToSession(
  conversationId: string,
  sessionId: string,
): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM conversations WHERE id = $1 AND session_id = $2`,
    [conversationId, sessionId],
  );
  return (result.rowCount ?? 0) > 0;
}
