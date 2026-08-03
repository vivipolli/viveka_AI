import type { SourceReference, SupportedLanguage } from "shared";
import { config } from "../config.js";
import { query, toVectorLiteral } from "../database/client.js";

export interface CachedAnswer {
  answer: string;
  sources: SourceReference[];
  readingSuggestion?: string;
}

/**
 * Busca no cache uma pergunta semanticamente equivalente. Retorna a resposta
 * salva apenas se a similaridade de cosseno superar o limite configurado.
 */
export async function findCachedAnswer(
  embedding: number[],
  language: SupportedLanguage,
): Promise<CachedAnswer | null> {
  if (!config.cacheEnabled) return null;

  const result = await query<{
    answer: string;
    sources: SourceReference[] | null;
    reading_suggestion: string | null;
    similarity: number;
  }>(
    `SELECT answer,
            sources,
            reading_suggestion,
            1 - (question_embedding <=> $1::vector) AS similarity
     FROM response_cache
     WHERE question_embedding IS NOT NULL
       AND language = $2
     ORDER BY question_embedding <=> $1::vector
     LIMIT 1`,
    [toVectorLiteral(embedding), language],
  );

  const row = result.rows[0];
  if (!row || row.similarity < config.cacheSimilarityThreshold) {
    return null;
  }

  return {
    answer: row.answer,
    sources: row.sources ?? [],
    readingSuggestion: row.reading_suggestion ?? undefined,
  };
}

/** Salva a resposta gerada no cache para reutilizacao futura. */
export async function saveCachedAnswer(params: {
  question: string;
  embedding: number[];
  answer: string;
  sources: SourceReference[];
  readingSuggestion?: string;
  language: SupportedLanguage;
}): Promise<void> {
  if (!config.cacheEnabled) return;

  await query(
    `INSERT INTO response_cache
       (question, question_embedding, answer, sources, reading_suggestion, language)
     VALUES ($1, $2::vector, $3, $4, $5, $6)`,
    [
      params.question,
      toVectorLiteral(params.embedding),
      params.answer,
      JSON.stringify(params.sources),
      params.readingSuggestion ?? null,
      params.language,
    ],
  );
}
