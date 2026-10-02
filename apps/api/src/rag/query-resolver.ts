import type { ChatTurn, LLMProvider } from "../providers/llm/LLMProvider.js";
import { formatConversationHistory } from "../prompts/system.js";

export interface ResolvedSearchQuery {
  searchQuery: string;
  continuesPrevious: boolean;
}

const RESOLVER_SYSTEM = `You classify whether the latest user message continues the prior conversation or starts a new topic.

Return ONLY valid JSON, no markdown:
{"continuesPrevious":true|false,"searchQuery":"..."}

How to decide:
- continuesPrevious=true when the latest message depends on earlier turns to be understood (incomplete subject, reference to something just discussed, request to expand/list/clarify the prior topic).
- continuesPrevious=false when the latest message is self-contained and introduces a different subject on its own.

When continuesPrevious=true, rewrite searchQuery as one complete standalone search question that includes the concrete subject from the prior conversation (so a document search can find the right passages).
When continuesPrevious=false, set searchQuery to the latest message unchanged.

searchQuery must be in the same language as the latest message.`;

/**
 * Usa o LLM para decidir continuidade e produzir uma query de busca autonoma.
 * Sem listas de palavras: a propria IA interpreta o contexto.
 */
export async function resolveSearchQuery(
  question: string,
  history: ChatTurn[],
  llm: LLMProvider,
): Promise<ResolvedSearchQuery> {
  if (history.length === 0) {
    return { searchQuery: question, continuesPrevious: false };
  }

  const conversation = formatConversationHistory(history, 6);
  const raw = await llm.generateComplete({
    system: RESOLVER_SYSTEM,
    user: `CONVERSATION:\n${conversation}\n\nLATEST MESSAGE:\n${question}`,
    maxTokens: 220,
    temperature: 0,
  });

  return parseResolverOutput(raw, question);
}

export function parseResolverOutput(
  raw: string,
  fallbackQuestion: string,
): ResolvedSearchQuery {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return { searchQuery: fallbackQuestion, continuesPrevious: false };
  }

  try {
    const parsed = JSON.parse(match[0]) as {
      continuesPrevious?: unknown;
      searchQuery?: unknown;
    };

    const continuesPrevious = parsed.continuesPrevious === true;
    const searchQuery =
      typeof parsed.searchQuery === "string" && parsed.searchQuery.trim()
        ? parsed.searchQuery.trim()
        : fallbackQuestion;

    return { searchQuery, continuesPrevious };
  } catch {
    return { searchQuery: fallbackQuestion, continuesPrevious: false };
  }
}
