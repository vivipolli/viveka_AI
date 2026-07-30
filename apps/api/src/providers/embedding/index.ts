import type { EmbeddingProvider } from "./EmbeddingProvider.js";
import { OpenAIEmbeddingProvider } from "./OpenAIProvider.js";

let instance: EmbeddingProvider | null = null;

/** Retorna o provider de embeddings ativo (singleton). */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (!instance) {
    instance = new OpenAIEmbeddingProvider();
  }
  return instance;
}

export type { EmbeddingProvider } from "./EmbeddingProvider.js";
