import { config } from "../config.js";
import { estimateTokens } from "../lib/tokens.js";
import { hybridSearchRaw, type RetrievedChunk } from "../vector/store.js";

export interface ScoredChunk extends RetrievedChunk {
  finalScore: number;
}

const MAX_STORY_CHUNKS = 2;

/**
 * Recupera os chunks mais relevantes combinando busca vetorial e textual,
 * limitando o total de tokens para nunca ultrapassar o contexto do modelo.
 */
export async function retrieveChunks(
  embedding: number[],
  questionText: string,
  maxContextTokens: number,
): Promise<ScoredChunk[]> {
  const candidateLimit = Math.max(config.retrievalMaxChunks * 3, 20);
  const raw = await hybridSearchRaw(embedding, questionText, candidateLimit);
  if (raw.length === 0) return [];

  const scored = combineScores(raw);
  const ranked = config.rerankEnabled ? rerank(scored) : scored;

  return applyLimits(ranked, maxContextTokens);
}

/** Normaliza os scores vetorial e textual para [0,1] e combina por peso. */
function combineScores(chunks: RetrievedChunk[]): ScoredChunk[] {
  const maxVector = Math.max(...chunks.map((c) => c.vectorScore), 1e-6);
  const maxText = Math.max(...chunks.map((c) => c.textScore), 1e-6);

  return chunks
    .map((c) => {
      const vNorm = c.vectorScore / maxVector;
      const tNorm = c.textScore / maxText;
      const finalScore =
        config.hybridVectorWeight * vNorm + config.hybridTextWeight * tNorm;
      return { ...c, finalScore };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Reranking simples baseado em cobertura de termos da pergunta.
 * Placeholder leve para um cross-encoder futuro, sem custo de rede.
 */
function rerank(chunks: ScoredChunk[]): ScoredChunk[] {
  return [...chunks].sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Seleciona entre RETRIEVAL_MIN e RETRIEVAL_MAX chunks, reduzindo o total
 * caso ultrapasse o orcamento de tokens de contexto (com margem para prompt).
 */
function applyLimits(chunks: ScoredChunk[], maxContextTokens: number): ScoredChunk[] {
  const budget = Math.floor(maxContextTokens * 0.5);
  const selected: ScoredChunk[] = [];
  let used = 0;
  let storyCount = 0;

  for (const chunk of chunks) {
    if (selected.length >= config.retrievalMaxChunks) break;
    if (chunk.type === "story" && storyCount >= MAX_STORY_CHUNKS) continue;

    const tokens = estimateTokens(chunk.content);
    if (used + tokens > budget && selected.length >= config.retrievalMinChunks) {
      break;
    }
    selected.push(chunk);
    used += tokens;
    if (chunk.type === "story") storyCount++;
  }

  return selected;
}
