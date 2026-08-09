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
  state.buffer += token;

  if (state.metadataStarted) return null;

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
    return parseFallbackMetadata(raw);
  }

  const answer = raw.slice(0, markerIdx).trim();
  const jsonPart = raw.slice(markerIdx + METADATA_MARKER.length).trim();

  return parseMetadataJson(answer, jsonPart);
}

function parseFallbackMetadata(raw: string): ParsedChatResponse {
  const match = raw.match(/\nCITATION_JSON\s*:\s*(\{[\s\S]*\})\s*$/i);
  if (!match) {
    return { answer: raw.trim(), usedSourceIndices: [] };
  }

  const answer = raw.slice(0, match.index).trim();
  return parseMetadataJson(answer, match[1]);
}

function parseMetadataJson(answer: string, jsonPart: string): ParsedChatResponse {
  const cleaned = jsonPart
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as {
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

  const indices = value
    .map((item) => {
      if (typeof item === "number" && Number.isInteger(item)) return item;
      if (typeof item === "string" && /^\d+$/.test(item)) return Number(item);
      return null;
    })
    .filter((item): item is number => item !== null && item > 0);

  return [...new Set(indices)];
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
