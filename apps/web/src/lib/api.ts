import type {
  ChatMessage,
  ChatStreamEvent,
  Conversation,
  DocumentMetadata,
} from "shared";
import { apiUrl } from "./config.js";

export interface StreamCallbacks {
  onEvent: (event: ChatStreamEvent) => void;
  onError: (status: number) => void;
}

/** Envia a pergunta e consome a resposta via SSE (Server-Sent Events). */
export async function streamChat(
  body: { sessionId: string; conversationId?: string; question: string },
  callbacks: StreamCallbacks,
): Promise<void> {
  const res = await fetch(apiUrl("/api/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    callbacks.onError(res.status);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        callbacks.onEvent(JSON.parse(json) as ChatStreamEvent);
      } catch {
        // ignora fragmentos malformados
      }
    }
  }
}

export async function fetchConversations(
  sessionId: string,
): Promise<Conversation[]> {
  const res = await fetch(
    `/api/conversations?sessionId=${encodeURIComponent(sessionId)}`,
  );
  const data = (await res.json()) as { conversations: Conversation[] };
  return data.conversations;
}

export async function fetchMessages(
  conversationId: string,
  sessionId: string,
): Promise<ChatMessage[]> {
  const res = await fetch(
    `/api/conversations/${conversationId}/messages?sessionId=${encodeURIComponent(sessionId)}`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { messages: ChatMessage[] };
  return data.messages;
}

export async function sendFeedback(
  question: string,
  rating: 1 | -1,
): Promise<void> {
  await fetch(apiUrl("/api/feedback"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, rating }),
  });
}

// ---------- Admin ----------

function adminHeaders(password: string): HeadersInit {
  return { "x-admin-password": password };
}

export async function adminLogin(password: string): Promise<boolean> {
  const res = await fetch(apiUrl("/api/admin/login"), {
    method: "POST",
    headers: adminHeaders(password),
  });
  return res.ok;
}

export async function adminListDocuments(
  password: string,
): Promise<DocumentMetadata[]> {
  const res = await fetch(apiUrl("/api/admin/documents"), {
    headers: adminHeaders(password),
  });
  const data = (await res.json()) as { documents: DocumentMetadata[] };
  return data.documents;
}

export async function adminUploadFile(
  password: string,
  file: File,
  fields: Record<string, string>,
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(fields)) {
    if (value) form.append(key, value);
  }
  await fetch(apiUrl("/api/admin/documents/upload"), {
    method: "POST",
    headers: adminHeaders(password),
    body: form,
  });
}

export async function adminUploadText(
  password: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await fetch(apiUrl("/api/admin/documents/text"), {
    method: "POST",
    headers: { ...adminHeaders(password), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function adminReprocess(
  password: string,
  id: string,
): Promise<void> {
  await fetch(apiUrl(`/api/admin/documents/${id}/reprocess`), {
    method: "POST",
    headers: adminHeaders(password),
  });
}

export async function adminDeleteDocument(
  password: string,
  id: string,
): Promise<void> {
  await fetch(apiUrl(`/api/admin/documents/${id}`), {
    method: "DELETE",
    headers: adminHeaders(password),
  });
}

export async function adminFetchChunks(
  password: string,
  id: string,
): Promise<{ index: number; content: string }[]> {
  const res = await fetch(apiUrl(`/api/admin/documents/${id}/chunks`), {
    headers: adminHeaders(password),
  });
  const data = (await res.json()) as {
    chunks: { index: number; content: string }[];
  };
  return data.chunks;
}

export async function adminDownloadPdf(
  password: string,
  id: string,
  fileName: string,
): Promise<void> {
  const res = await fetch(apiUrl(`/api/admin/documents/${id}/download`), {
    headers: adminHeaders(password),
  });
  if (!res.ok) throw new Error("download failed");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function adminReindex(password: string): Promise<void> {
  await fetch(apiUrl("/api/admin/reindex"), {
    method: "POST",
    headers: adminHeaders(password),
  });
}
