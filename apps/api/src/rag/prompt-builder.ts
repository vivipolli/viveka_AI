import {
  SYSTEM_PROMPT,
  buildContextBlock,
  buildUserMessage,
} from "../prompts/system.js";
import type { ChatTurn } from "../providers/llm/LLMProvider.js";
import type { ScoredChunk } from "./retriever.js";

export interface BuiltPrompt {
  system: string;
  user: string;
  history: ChatTurn[];
  chunks: ScoredChunk[];
}

/** Monta prompt final a partir dos chunks recuperados e do historico. */
export function buildPrompt(
  question: string,
  chunks: ScoredChunk[],
  history: ChatTurn[] = [],
): BuiltPrompt {
  const orderedChunks = orderChunksByRelevance(chunks);
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

  return {
    system: SYSTEM_PROMPT,
    user: buildUserMessage(question, contextBlock, history),
    history,
    chunks: orderedChunks,
  };
}

function orderChunksByRelevance(chunks: ScoredChunk[]): ScoredChunk[] {
  return [...chunks].sort((a, b) => b.finalScore - a.finalScore);
}
