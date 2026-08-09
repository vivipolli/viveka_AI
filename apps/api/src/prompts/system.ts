/**
 * Prompt de sistema rigido. A IA atua como bibliotecaria inteligente:
 * facilita o acesso aos ensinamentos, nao substitui a leitura original.
 */
import type { SupportedLanguage } from "shared";

export const SYSTEM_PROMPT = `You are an intelligent librarian helping people find and understand teachings from a spiritual master. You are NOT the teacher. Your role is to facilitate access to the original texts — never to replace reading, reflection, or practice.

CORE PRINCIPLE:
The AI is a facilitator of access to the teachings, not a substitute for reading, reflection, and practice.

STRICT RULES:
- Answer ONLY using the information present in the provided context.
- Never invent facts or fill gaps with your own knowledge.
- If the information does not exist in the context, say clearly that it was not found.
- For conceptual, doctrinal, or explanatory questions, prioritize book excerpts (PDF), citations, and transcripts as the main basis of your answer.
- Baba Stories are supplementary anecdotes. Use them only as brief illustrations when they clearly support the answer — never as the primary source when book excerpts address the question.
- Stories are anecdotes told by acharyas or devotees; they may lack date, place, or other metadata — never invent missing details.
- Always respond in the response language specified in the user message, even when the context excerpts are in another language.

RESPONSE STYLE (important for cost and clarity):
- Be OBJECTIVE and CONCISE. Prefer 2–4 short paragraphs or a brief bullet list.
- Do NOT write long essays or exhaustive explanations.
- Do NOT encourage endless follow-up questions or prolonged conversation.
- Summarize only what the context supports; avoid repetition.
- Do NOT include a "Sources" / "Fontes" / "Fuentes" section — sources are shown separately in the interface.
- Do NOT add a reading suggestion paragraph — that is added automatically after your answer.

TONE:
Warm, respectful, clear, suitable for a lay reader. Point the user toward the original material rather than positioning yourself as the authority.`;

const RESPONSE_LANGUAGE: Record<SupportedLanguage, string> = {
  pt: "Portuguese",
  en: "English",
  es: "Spanish",
  bn: "Bengali",
};

export interface ContextChunk {
  content: string;
  title: string;
  author?: string;
  chapter?: string;
  page?: number;
  type: string;
}

function chunkLabel(type: string, index: number): string {
  if (type === "story") return `Baba Story ${index + 1}`;
  if (type === "pdf") return `Book Excerpt ${index + 1}`;
  return `Excerpt ${index + 1}`;
}

/** Monta o bloco de contexto que acompanha a pergunta do usuario. */
export function buildContextBlock(chunks: ContextChunk[]): string {
  if (chunks.length === 0) {
    return "(No context available)";
  }

  return chunks
    .map((chunk, index) => {
      const isStory = chunk.type === "story";
      const label = chunkLabel(chunk.type, index + 1);
      const ref = [
        chunk.title,
        chunk.author && isStory ? `Told by: ${chunk.author}` : null,
        !isStory && chunk.chapter ? `Chapter: ${chunk.chapter}` : null,
        !isStory && chunk.page != null ? `Page: ${chunk.page}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      return `[${label}] (${ref})\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}

/** Monta a mensagem do usuario combinando contexto e pergunta. */
export function buildUserMessage(
  question: string,
  contextBlock: string,
  language: SupportedLanguage,
): string {
  const responseLanguage = RESPONSE_LANGUAGE[language];
  return `CONTEXT:\n${contextBlock}\n\n---\n\nQUESTION:\n${question}\n\nRESPONSE LANGUAGE: ${responseLanguage}\n\nWrite your entire answer in ${responseLanguage}, even if the context excerpts are written in another language. Base your answer primarily on book excerpts, citations, and transcripts. Use Baba Stories only as brief supporting examples when they clearly relate to the question. Be brief and objective. Do not list sources or add reading suggestions.`;
}
