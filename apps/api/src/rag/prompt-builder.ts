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
    user: buildUserMessage(question, contextBlock),
    history,
    chunks: orderedChunks,
  };
}

function orderChunksByRelevance(chunks: ScoredChunk[]): ScoredChunk[] {
  return [...chunks].sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Limiar abaixo do cache (0.92 = pergunta equivalente).
 * ~0.70 distingue continuidade de tema de mudanca de assunto.
 */
export const TOPIC_CONTINUATION_THRESHOLD = 0.7;

/**
 * Monta texto de busca enriquecido com turnos recentes, para follow-ups
 * como "fale mais sobre isso" encontrarem trechos relevantes.
 */
export function buildRetrievalQuery(
  question: string,
  history: ChatTurn[],
  maxPriorTurns = 4,
): string {
  if (history.length === 0) return question;

  const recent = history.slice(-maxPriorTurns);
  const prior = recent
    .map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`)
    .join("\n");

  return `${prior}\nUser: ${question}`;
}

/** Textos recentes para medir se a pergunta continua o mesmo tema. */
export function topicAnchorTexts(history: ChatTurn[]): string[] {
  const lastUser = [...history].reverse().find((turn) => turn.role === "user");
  const lastAssistant = [...history].reverse().find((turn) => turn.role === "assistant");
  const anchors: string[] = [];

  if (lastUser?.content.trim()) {
    anchors.push(lastUser.content.trim());
  }
  if (lastAssistant?.content.trim()) {
    anchors.push(lastAssistant.content.trim().slice(0, 1200));
  }

  return anchors;
}
