import type { DocumentType, SourceReference } from "shared";
import { makeExcerpt } from "../lib/text.js";
import {
  SYSTEM_PROMPT,
  buildContextBlock,
  buildUserMessage,
} from "../prompts/system.js";
import {
  buildReadingSuggestion,
  primarySourceFromChunks,
  type PrimarySource,
} from "./reading-suggestion.js";
import type { ScoredChunk } from "./retriever.js";

export interface BuiltPrompt {
  system: string;
  user: string;
  sources: SourceReference[];
  primarySource?: PrimarySource;
  readingSuggestion?: string;
}

const MAX_CITATION_SOURCES = 2;
const CITATION_SCORE_RATIO = 0.75;

/** Monta prompt final, fontes e sugestao de leitura a partir dos chunks recuperados. */
export function buildPrompt(question: string, chunks: ScoredChunk[]): BuiltPrompt {
  const orderedChunks = prioritizeStoryChunks(chunks);
  const contextBlock = buildContextBlock(
    orderedChunks.map((c) => ({
      content: c.content,
      title: c.title,
      author: c.author ?? undefined,
      chapter: c.chapter ?? undefined,
      page: c.page ?? undefined,
      type: c.type,
    })),
  );

  const sources = selectCitationSources(orderedChunks);
  const primarySource = primarySourceFromChunks(orderedChunks);
  const readingSuggestion = buildReadingSuggestion(primarySource, question);

  return {
    system: SYSTEM_PROMPT,
    user: buildUserMessage(question, contextBlock),
    sources,
    primarySource,
    readingSuggestion,
  };
}

function chunkToSource(chunk: ScoredChunk): SourceReference {
  return {
    documentId: chunk.documentId,
    title: chunk.title,
    author: chunk.author ?? undefined,
    chapter: chunk.chapter ?? undefined,
    page: chunk.page ?? undefined,
    year: chunk.year ?? undefined,
    type: chunk.type as DocumentType,
    excerpt: makeExcerpt(chunk.content),
  };
}

/** Seleciona apenas as fontes principais usadas na resposta (nao todo o contexto RAG). */
function selectCitationSources(chunks: ScoredChunk[]): SourceReference[] {
  if (chunks.length === 0) return [];

  const bestByDocument = new Map<string, ScoredChunk>();
  for (const chunk of chunks) {
    const existing = bestByDocument.get(chunk.documentId);
    if (!existing || chunk.finalScore > existing.finalScore) {
      bestByDocument.set(chunk.documentId, chunk);
    }
  }

  const ranked = [...bestByDocument.values()].sort((a, b) => {
    const aStory = a.type === "story" ? 1 : 0;
    const bStory = b.type === "story" ? 1 : 0;
    if (aStory !== bStory) return bStory - aStory;
    return b.finalScore - a.finalScore;
  });

  const topScore = ranked[0]?.finalScore ?? 0;
  const minScore = topScore * CITATION_SCORE_RATIO;

  const selected = ranked
    .filter((chunk) => chunk.finalScore >= minScore)
    .slice(0, MAX_CITATION_SOURCES);

  return dedupeSources(selected.map(chunkToSource));
}

/** Remove fontes duplicadas (mesmo documento + capitulo + pagina). */
function dedupeSources(sources: SourceReference[]): SourceReference[] {
  const seen = new Set<string>();
  const result: SourceReference[] = [];

  for (const source of sources) {
    const key = `${source.documentId}|${source.chapter ?? ""}|${source.page ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }

  return result;
}

function prioritizeStoryChunks(chunks: ScoredChunk[]): ScoredChunk[] {
  return [...chunks].sort((a, b) => {
    const aStory = a.type === "story" ? 1 : 0;
    const bStory = b.type === "story" ? 1 : 0;
    if (aStory !== bStory) return bStory - aStory;
    return b.finalScore - a.finalScore;
  });
}
