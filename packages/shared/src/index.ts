export type SupportedLanguage = "pt" | "en" | "es" | "bn";

export type DocumentType = "pdf" | "citation" | "story" | "transcript";

export const DOCUMENT_TYPES: DocumentType[] = [
  "pdf",
  "citation",
  "story",
  "transcript",
];

export type DocumentStatus = "processing" | "indexed" | "error";

export type MessageRole = "user" | "assistant";

/** Referencia de fonte anexada a cada resposta da IA. */
export interface SourceReference {
  documentId: string;
  title: string;
  author?: string;
  chapter?: string;
  page?: number;
  year?: number;
  type: DocumentType;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  sources?: SourceReference[];
  /** Sugestao de leitura apontando ao trecho original da mestre. */
  readingSuggestion?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  author?: string;
  chapter?: string;
  page?: number;
  year?: number;
  type: DocumentType;
  language: SupportedLanguage;
  source?: string;
  status: DocumentStatus;
  chunkCount?: number;
  hasFile?: boolean;
  createdAt: string;
}

/** Corpo enviado ao endpoint de chat. */
export interface ChatRequest {
  sessionId: string;
  conversationId?: string;
  question: string;
}

/** Eventos emitidos via SSE pelo endpoint de chat. */
export type ChatStreamEvent =
  | { type: "meta"; conversationId: string; messageId: string }
  | { type: "token"; value: string }
  | { type: "sources"; sources: SourceReference[] }
  | { type: "readingSuggestion"; text: string }
  | { type: "cached"; cached: boolean }
  | { type: "done" }
  | { type: "error"; message: string };

export interface FeedbackRequest {
  question: string;
  rating: 1 | -1;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["pt", "en", "es", "bn"];
