import type { DocumentType, SourceReference } from "shared";
import { makeExcerpt } from "../lib/text.js";
import type { ScoredChunk } from "./retriever.js";

const METADATA_MARKER = "\nCITATION_JSON:";

export interface ParsedChatResponse {
  answer: string;
  usedSourceIndices: number[];
  readingSuggestion?: string;
}

export interface StreamParseState {
  buffer: string;
  displayedLength: number;
  metadataStarted: boolean;
}

export function createStreamParseState(): StreamParseState {
  return { buffer: "", displayedLength: 0, metadataStarted: false };
}

/** Tokens visiveis ao usuario, segurando possivel inicio do bloco de metadados. */
export function consumeStreamToken(
  state: StreamParseState,
  token: string,
): string | null {
  if (state.metadataStarted) return null;

  state.buffer += token;
  const markerIdx = state.buffer.indexOf(METADATA_MARKER);
  if (markerIdx >= 0) {
    const visible = state.buffer.slice(0, markerIdx);
    const delta = visible.slice(state.displayedLength);
    state.displayedLength = visible.length;
    state.metadataStarted = true;
    return delta.length > 0 ? delta : null;
  }

  const safeEnd = findSafeYieldEnd(state.buffer);
  const delta = state.buffer.slice(state.displayedLength, safeEnd);
  state.displayedLength = safeEnd;
  return delta.length > 0 ? delta : null;
}

function findSafeYieldEnd(buffer: string): number {
  const marker = METADATA_MARKER;
  for (let i = 1; i < marker.length; i++) {
    const partial = marker.slice(0, i);
    if (buffer.endsWith(partial)) {
      return buffer.length - partial.length;
    }
  }
  return buffer.length;
}

export function parseChatResponse(raw: string): ParsedChatResponse {
  const markerIdx = raw.indexOf(METADATA_MARKER);
  if (markerIdx < 0) {
    return { answer: raw.trim(), usedSourceIndices: [] };
  }

  const answer = raw.slice(0, markerIdx).trim();
  const jsonPart = raw.slice(markerIdx + METADATA_MARKER.length).trim();

  try {
    const parsed = JSON.parse(jsonPart) as {
      usedSources?: unknown;
      readingSuggestion?: unknown;
    };
    const usedSourceIndices = normalizeIndices(parsed.usedSources);
    const readingSuggestion =
      typeof parsed.readingSuggestion === "string" &&
      parsed.readingSuggestion.trim().length > 0
        ? parsed.readingSuggestion.trim()
        : undefined;

    return { answer, usedSourceIndices, readingSuggestion };
  } catch {
    return { answer, usedSourceIndices: [] };
  }
}

function normalizeIndices(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is number => Number.isInteger(item) && item > 0))];
}

export function resolveSourcesFromIndices(
  indices: number[],
  chunks: ScoredChunk[],
): SourceReference[] {
  const sources: SourceReference[] = [];
  const seen = new Set<string>();

  for (const index of indices) {
    const chunk = chunks[index - 1];
    if (!chunk) continue;

    const key = `${chunk.documentId}|${chunk.chapter ?? ""}|${chunk.page ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    sources.push({
      documentId: chunk.documentId,
      title: chunk.title,
      author: chunk.author ?? undefined,
      chapter: chunk.chapter ?? undefined,
      page: chunk.page ?? undefined,
      year: chunk.year ?? undefined,
      type: chunk.type as DocumentType,
      excerpt: makeExcerpt(chunk.content),
    });
  }

  return sources;
}
