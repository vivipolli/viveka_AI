import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(__dirname, "..");
const monorepoRoot = resolve(__dirname, "../../..");

loadEnv({ path: resolve(monorepoRoot, ".env") });
loadEnv({ path: resolve(apiRoot, ".env") });

function str(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  return raw === "true" || raw === "1";
}

export type LLMProviderName = "openai" | "gemini" | "claude";
export type EmbeddingProviderName = "openai";

export const config = {
  port: num("PORT", 3333),
  nodeEnv: str("NODE_ENV", "development"),
  corsOrigin: str("CORS_ORIGIN", "http://localhost:5173")
    .split(",")
    .map((o) => o.trim()),

  databaseUrl: str("DATABASE_URL"),

  llmProvider: str("LLM_PROVIDER", "openai") as LLMProviderName,
  embeddingProvider: str("EMBEDDING_PROVIDER", "openai") as EmbeddingProviderName,

  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",

  openaiLlmModel: str("OPENAI_LLM_MODEL", "gpt-4o-mini"),
  openaiEmbeddingModel: str("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
  geminiLlmModel: str("GEMINI_LLM_MODEL", "gemini-1.5-flash"),
  claudeLlmModel: str("CLAUDE_LLM_MODEL", "claude-3-haiku-20240307"),

  chunkSize: num("CHUNK_SIZE", 800),
  chunkOverlap: num("CHUNK_OVERLAP", 100),
  retrievalMinChunks: num("RETRIEVAL_MIN_CHUNKS", 5),
  retrievalMaxChunks: num("RETRIEVAL_MAX_CHUNKS", 10),
  hybridVectorWeight: num("HYBRID_VECTOR_WEIGHT", 0.7),
  hybridTextWeight: num("HYBRID_TEXT_WEIGHT", 0.3),
  rerankEnabled: bool("RERANK_ENABLED", false),

  cacheEnabled: bool("CACHE_ENABLED", true),
  cacheSimilarityThreshold: num("CACHE_SIMILARITY_THRESHOLD", 0.92),

  rateLimitMax: num("RATE_LIMIT_MAX", 20),
  rateLimitWindow: num("RATE_LIMIT_WINDOW", 86400),

  adminPassword: str("ADMIN_PASSWORD", "troque-esta-senha"),

  conversationRetentionDays: num("CONVERSATION_RETENTION_DAYS", 30),

  /** Limite de tokens na resposta do LLM (resposta + linha CITATION_JSON). */
  llmMaxOutputTokens: num("LLM_MAX_OUTPUT_TOKENS", 450),

  /** Dimensao dos embeddings; deve casar com o schema VECTOR(n). */
  embeddingDimensions: 1536,
} as const;
