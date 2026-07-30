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

/** Monta prompt final, fontes e sugestao de leitura a partir dos chunks recuperados. */
export function buildPrompt(question: string, chunks: ScoredChunk[]): BuiltPrompt {
  const contextBlock = buildContextBlock(
    chunks.map((c) => ({
      content: c.content,
      title: c.title,
      author: c.author ?? undefined,
      chapter: c.chapter ?? undefined,
      page: c.page ?? undefined,
      type: c.type,
    })),
  );

  const sources = dedupeSources(
    chunks.map((c) => ({
      documentId: c.documentId,
      title: c.title,
      author: c.author ?? undefined,
      chapter: c.chapter ?? undefined,
      page: c.page ?? undefined,
      year: c.year ?? undefined,
      type: c.type as DocumentType,
      excerpt: makeExcerpt(c.content),
    })),
  );

  const primarySource = primarySourceFromChunks(chunks);
  const readingSuggestion = buildReadingSuggestion(primarySource, question);

  return {
    system: SYSTEM_PROMPT,
    user: buildUserMessage(question, contextBlock),
    sources,
    primarySource,
    readingSuggestion,
  };
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
