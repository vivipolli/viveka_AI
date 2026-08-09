import { config } from "../config.js";
import { estimateTokens } from "../lib/tokens.js";
import { PRIMARY_SOURCE_TYPES } from "./source-types.js";
import { hybridSearchRaw, type RetrievedChunk } from "../vector/store.js";

export interface ScoredChunk extends RetrievedChunk {
  finalScore: number;
}

const KEYWORD_BOOST_WEIGHT = 0.35;
const QUERY_STOPWORDS = new Set([
  "what",
  "how",
  "why",
  "when",
  "where",
  "which",
  "who",
  "does",
  "about",
  "the",
  "and",
  "for",
  "como",
  "qual",
  "quais",
  "quem",
  "onde",
  "porque",
  "sobre",
  "para",
  "uma",
  "uns",
  "umas",
  "que",
  "nos",
  "nas",
  "dos",
  "das",
  "segundo",
  "ensinamentos",
  "baba",
  "textos",
  "dizem",
  "teach",
  "teachings",
  "according",
  "master",
]);

/**
 * Recupera os chunks mais relevantes combinando busca vetorial e textual.
 * Prioriza livros, citacoes e transcricoes; historias so entram se nao houver
 * material primario relevante.
 */
export async function retrieveChunks(
  embedding: number[],
  questionText: string,
  maxContextTokens: number,
): Promise<ScoredChunk[]> {
  const candidateLimit = Math.max(config.retrievalMaxChunks * 4, 30);
  const queryTerms = extractQueryTerms(questionText);

  const primaryRaw = await hybridSearchRaw(embedding, questionText, candidateLimit, {
    types: [...PRIMARY_SOURCE_TYPES],
  });
  const primaryRanked = rankChunks(primaryRaw, queryTerms);
  const primarySelected = applyLimits(primaryRanked, maxContextTokens);

  if (primarySelected.length > 0) {
    return primarySelected;
  }

  const storyRaw = await hybridSearchRaw(embedding, questionText, candidateLimit, {
    types: ["story"],
  });
  const storyRanked = rankChunks(storyRaw, queryTerms);
  return applyLimits(storyRanked, maxContextTokens);
}

function rankChunks(chunks: RetrievedChunk[], queryTerms: string[]): ScoredChunk[] {
  const scored = combineScores(chunks, queryTerms);
  return config.rerankEnabled ? rerank(scored) : scored;
}

function extractQueryTerms(question: string): string[] {
  const normalized = normalizeForMatch(question);
  const words =
    normalized.match(/[\p{L}\p{N}]{3,}/gu)?.map((word) => word.toLowerCase()) ?? [];

  return [...new Set(words.filter((word) => !QUERY_STOPWORDS.has(word)))];
}

function normalizeForMatch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

function keywordMatchBoost(terms: string[], content: string): number {
  if (terms.length === 0) return 0;

  const normalizedContent = normalizeForMatch(content.toLowerCase());
  const hits = terms.filter((term) => normalizedContent.includes(term)).length;
  return hits / terms.length;
}

/** Normaliza os scores vetorial e textual para [0,1] e combina por peso. */
function combineScores(chunks: RetrievedChunk[], queryTerms: string[]): ScoredChunk[] {
  const maxVector = Math.max(...chunks.map((c) => c.vectorScore), 1e-6);
  const maxText = Math.max(...chunks.map((c) => c.textScore), 1e-6);

  return chunks
    .map((c) => {
      const vNorm = c.vectorScore / maxVector;
      const tNorm = c.textScore / maxText;
      const keywordBoost = keywordMatchBoost(queryTerms, c.content);
      const finalScore =
        config.hybridVectorWeight * vNorm +
        config.hybridTextWeight * tNorm +
        KEYWORD_BOOST_WEIGHT * keywordBoost;
      return { ...c, finalScore };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

function rerank(chunks: ScoredChunk[]): ScoredChunk[] {
  return [...chunks].sort((a, b) => b.finalScore - a.finalScore);
}

function applyLimits(chunks: ScoredChunk[], maxContextTokens: number): ScoredChunk[] {
  const budget = Math.floor(maxContextTokens * 0.5);
  const selected: ScoredChunk[] = [];
  let used = 0;

  for (const chunk of chunks) {
    if (selected.length >= config.retrievalMaxChunks) break;

    const tokens = estimateTokens(chunk.content);
    if (used + tokens > budget && selected.length >= config.retrievalMinChunks) {
      break;
    }
    selected.push(chunk);
    used += tokens;
  }

  return selected;
}
