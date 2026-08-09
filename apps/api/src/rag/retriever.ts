import { config } from "../config.js";
import { estimateTokens } from "../lib/tokens.js";
import { isPrimarySourceType } from "./source-types.js";
import { hybridSearchRaw, type RetrievedChunk } from "../vector/store.js";

export interface ScoredChunk extends RetrievedChunk {
  finalScore: number;
}

const KEYWORD_BOOST_WEIGHT = 0.35;
const MAX_STORY_CHUNKS = 2;
const STORY_MIN_RELATIVE_SCORE = 0.45;

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
 * Recupera chunks relevantes. Livros, citacoes e transcricoes formam a base;
 * historias entram como complemento quando forem relevantes.
 */
export async function retrieveChunks(
  embedding: number[],
  questionText: string,
  maxContextTokens: number,
): Promise<ScoredChunk[]> {
  const candidateLimit = Math.max(config.retrievalMaxChunks * 4, 30);
  const queryTerms = extractQueryTerms(questionText);

  const primaryRaw = await hybridSearchRaw(embedding, questionText, candidateLimit, {
    types: ["pdf", "citation", "transcript"],
  });
  const primaryRanked = rankChunks(primaryRaw, queryTerms);

  const storyRaw = await hybridSearchRaw(embedding, questionText, candidateLimit, {
    types: ["story"],
  });
  const storyRanked = rankChunks(storyRaw, queryTerms);

  return mergeContextChunks(primaryRanked, storyRanked, maxContextTokens);
}

function mergeContextChunks(
  primary: ScoredChunk[],
  stories: ScoredChunk[],
  maxContextTokens: number,
): ScoredChunk[] {
  if (primary.length === 0) {
    return applyLimits(stories, maxContextTokens);
  }

  const primaryBudget = Math.max(config.retrievalMaxChunks - MAX_STORY_CHUNKS, config.retrievalMinChunks);
  const primarySelected = applyLimits(primary, maxContextTokens, primaryBudget);

  const topPrimaryScore = primarySelected[0]?.finalScore ?? 0;
  const minStoryScore = Math.max(0.2, topPrimaryScore * STORY_MIN_RELATIVE_SCORE);
  const storyCandidates = stories
    .filter((chunk) => chunk.finalScore >= minStoryScore)
    .slice(0, MAX_STORY_CHUNKS);

  const combined = [...primarySelected, ...storyCandidates];

  return combined.sort((a, b) => {
    const aPrimary = isPrimarySourceType(a.type) ? 1 : 0;
    const bPrimary = isPrimarySourceType(b.type) ? 1 : 0;
    if (aPrimary !== bPrimary) return bPrimary - aPrimary;
    return b.finalScore - a.finalScore;
  });
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

function applyLimits(
  chunks: ScoredChunk[],
  maxContextTokens: number,
  maxChunks = config.retrievalMaxChunks,
): ScoredChunk[] {
  const budget = Math.floor(maxContextTokens * 0.5);
  const selected: ScoredChunk[] = [];
  let used = 0;

  for (const chunk of chunks) {
    if (selected.length >= maxChunks) break;

    const tokens = estimateTokens(chunk.content);
    if (used + tokens > budget && selected.length >= config.retrievalMinChunks) {
      break;
    }
    selected.push(chunk);
    used += tokens;
  }

  return selected;
}
