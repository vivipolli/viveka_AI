import type { ChatTurn, LLMProvider } from "../providers/llm/LLMProvider.js";

export interface ResolvedSearchQuery {
  searchQuery: string;
  continuesPrevious: boolean;
}

const RESOLVER_SYSTEM = `You resolve the user's latest message into a standalone search question for a document library.

Return ONLY valid JSON, no markdown:
{"continuesPrevious":true|false,"searchQuery":"..."}

Decision rule:
- Prefer continuesPrevious=true whenever the latest message is elliptical, fragmentary, a filter/refinement, a correction, or otherwise needs earlier turns to know WHAT topic is meant.
- Use continuesPrevious=false only when the latest message clearly names a different self-contained topic on its own.

When continuesPrevious=true:
- Identify the concrete subject the user was discussing (from the User turns; Assistant turns are supporting context).
- If the user later corrected the topic (e.g. "I meant X"), treat the corrected subject as current.
- Rewrite searchQuery as ONE complete standalone question.
- searchQuery MUST lead with that concrete prior subject, then add the new detail/filter from the latest message.
  Good: "Quais dos 16 Pontos de Ananda Marga são principais para mulheres?"
  Bad: "pontos principais para mulheres" (subject lost)
  Bad: "papel das mulheres no PROUT" (switched topic)

When continuesPrevious=false:
- Set searchQuery to the latest message unchanged (or lightly cleaned).

searchQuery must be in the same language as the latest message.`;

const ASSISTANT_TRUNCATE = 320;

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

  const conversation = formatHistoryForResolver(history, 8);
  const raw = await llm.generateComplete({
    system: RESOLVER_SYSTEM,
    user: `CONVERSATION:\n${conversation}\n\nLATEST MESSAGE:\n${question}`,
    maxTokens: 220,
    temperature: 0,
  });

  return parseResolverOutput(raw, question);
}

/** Historico enxuto: User intacto; Assistant truncado para nao diluir o topico. */
export function formatHistoryForResolver(
  history: ChatTurn[],
  maxTurns = 8,
): string {
  return history
    .slice(-maxTurns)
    .map((turn) => {
      const role = turn.role === "user" ? "User" : "Assistant";
      const content =
        turn.role === "assistant"
          ? truncateForResolver(turn.content, ASSISTANT_TRUNCATE)
          : turn.content.trim();
      return `${role}: ${content}`;
    })
    .join("\n\n");
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

function truncateForResolver(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trimEnd()}…`;
}
