import { config } from "../config.js";
import { estimateTokens } from "../lib/tokens.js";
import { normalizeWhitespace } from "../lib/text.js";

export interface TextChunk {
  content: string;
  index: number;
}

/**
 * Divide texto em chunks de ~CHUNK_SIZE tokens com sobreposicao de
 * CHUNK_OVERLAP tokens, respeitando limites de paragrafo/sentenca.
 */
export function chunkText(
  raw: string,
  chunkSize = config.chunkSize,
  overlap = config.chunkOverlap,
): TextChunk[] {
  const text = normalizeWhitespace(raw);
  if (!text) return [];

  const segments = splitIntoSegments(text);
  const chunks: TextChunk[] = [];

  let current: string[] = [];
  let currentTokens = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push({ content: current.join(" ").trim(), index: chunks.length });
  };

  for (const segment of segments) {
    const segTokens = estimateTokens(segment);

    if (currentTokens + segTokens > chunkSize && current.length > 0) {
      flush();
      const carried = carryOverlap(current, overlap);
      current = carried.segments;
      currentTokens = carried.tokens;
    }

    current.push(segment);
    currentTokens += segTokens;
  }

  flush();
  return chunks;
}

/** Quebra o texto em sentencas/paragrafos preservando pontuacao. */
function splitIntoSegments(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Retem os ultimos segmentos ate ~overlap tokens para o proximo chunk. */
function carryOverlap(
  segments: string[],
  overlap: number,
): { segments: string[]; tokens: number } {
  const carried: string[] = [];
  let tokens = 0;

  for (let i = segments.length - 1; i >= 0; i--) {
    const t = estimateTokens(segments[i]);
    if (tokens + t > overlap) break;
    carried.unshift(segments[i]);
    tokens += t;
  }

  return { segments: carried, tokens };
}
