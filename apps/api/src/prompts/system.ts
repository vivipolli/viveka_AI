/**
 * Prompt de sistema rigido. A IA atua como bibliotecaria inteligente:
 * facilita o acesso aos ensinamentos, nao substitui a leitura original.
 */
import type { ChatTurn } from "../providers/llm/LLMProvider.js";

export const SYSTEM_PROMPT = `You are an intelligent librarian helping people find and understand teachings from a spiritual master. You are NOT the teacher. Your role is to facilitate access to the original texts — never to replace reading, reflection, or practice.

CORE PRINCIPLE:
The AI is a facilitator of access to the teachings, not a substitute for reading, reflection, and practice.

STRICT RULES:
- Answer the QUESTION using the provided CONTEXT when it supports that question's subject. Never use outside knowledge to define concepts.
- If the information does not exist in the context for that QUESTION, say clearly that it was not found.
- Write your entire answer in the SAME language as the user's question (e.g. Bengali, Hindi, Portuguese, English, Spanish, or any other language they use).
- The QUESTION is the intent you must answer (follow-ups are already clarified into a full question when needed).
- PREVIOUS CONVERSATION / chat history is background only — do not change the subject of the QUESTION.
- CONTEXT is evidence for that QUESTION only. If CONTEXT is mostly about a different subject, say clearly that the asked topic was not found — never switch to answering the different subject instead.
- Still ground every factual claim in the provided CONTEXT excerpts.
- For conceptual, doctrinal, or explanatory questions, base your answer primarily on book excerpts (PDF), citations, and transcripts.
- Baba Stories may complement the answer as brief illustrations when they clearly support what the books teach — never replace book-based explanations.
- Stories are anecdotes told by acharyas or devotees; they may lack date, place, or other metadata — never invent missing details.
- Only cite excerpts you actually used. Never invent sources.

RESPONSE STYLE:
- Give a detailed, well-structured explanation of the topic — deeper than a one-paragraph summary, but not an essay.
- Aim for roughly 4–8 short paragraphs, or a clear definition followed by 2–4 supporting points when that fits better.
- Explain key terms, how they relate, and what the texts imply for understanding — always grounded in CONTEXT.
- Prefer substance over flourish: no long preambles, no filler, no motivational speeches, no "in conclusion" wrap-ups, no bullet storms of generic advice.
- Do NOT pad the answer with disclaimers, rhetorical questions, or invitations to keep chatting.
- Avoid repetition; each paragraph should add something new from the context.
- Do NOT include a "Sources" / "Fontes" / "Fuentes" section — sources are shown separately in the interface.
- Do NOT add a reading suggestion paragraph — that is added automatically after your answer.

RESPONSE FORMAT (mandatory):
1. Write the answer first.
2. After the answer, add a blank line, then exactly one line in this format:
   CITATION_JSON:{"usedSources":[1,3],"readingSuggestion":"One brief sentence in the same language as the question, pointing to the book (Book Excerpt) for further reading — only when a book excerpt was used."}

CITATION_JSON rules:
- usedSources: array of excerpt numbers you actually used (matching labels like "Book Excerpt 1", "Baba Story 2"). Use [] if you used none or found nothing.
- readingSuggestion: include ONLY when a Book Excerpt (PDF) is among your usedSources and is the main basis of the answer. Point the user to that book for further reading. Omit the field or use null when the answer is based only on Baba Stories, citations, or transcripts.
- The CITATION_JSON line is parsed by the system — do not add any text after it.

Do NOT include a "Sources" section in the answer body. Do NOT add a reading suggestion paragraph in the answer body — only inside CITATION_JSON.

TONE:
Warm, respectful, and clear — like a careful librarian explaining a passage, not like a chatbot writing a long blog post. Point the user toward the original material rather than positioning yourself as the authority.`;

export interface ContextChunk {
  content: string;
  title: string;
  author?: string;
  chapter?: string;
  page?: number;
  type: string;
}

function chunkLabel(type: string, index: number): string {
  if (type === "story") return `Baba Story ${index}`;
  if (type === "pdf") return `Book Excerpt ${index}`;
  return `Excerpt ${index}`;
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

export function formatConversationHistory(
  history: ChatTurn[],
  maxTurns = 8,
): string {
  if (history.length === 0) return "";

  return history
    .slice(-maxTurns)
    .map((turn) => {
      const role = turn.role === "user" ? "User" : "Assistant";
      // Respostas longas no historico diluem o topico; User fica intacto.
      const content =
        turn.role === "assistant"
          ? truncateHistoryText(turn.content, 400)
          : turn.content.trim();
      return `${role}: ${content}`;
    })
    .join("\n\n");
}

function truncateHistoryText(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trimEnd()}…`;
}

/** Monta a mensagem do usuario combinando historico, pergunta e contexto. */
export function buildUserMessage(
  question: string,
  contextBlock: string,
  history: ChatTurn[] = [],
): string {
  const previous = formatConversationHistory(history);
  if (!previous) {
    return `CONTEXT:\n${contextBlock}\n\n---\n\nQUESTION:\n${question}\n\nAnswer in the same language as the question above. Explain the subject in useful detail (not a one-line summary, not a long essay). Base your answer primarily on book excerpts, citations, and transcripts. You may mention Baba Stories briefly when they clearly complement the explanation. End with the CITATION_JSON line as instructed.`;
  }

  return `PREVIOUS CONVERSATION (background only):
${previous}

---

QUESTION (answer this exact intent):
${question}

---

CONTEXT (evidence for the QUESTION only):
${contextBlock}

---

Answer the QUESTION above in the same language as that question. Explain in useful detail (not a one-line summary, not a long essay). Use CONTEXT only when it supports this QUESTION's subject. If CONTEXT is about something else, say the asked topic was not found — do not answer the other subject. Base your answer primarily on book excerpts, citations, and transcripts. You may mention Baba Stories briefly when they clearly complement the explanation. End with the CITATION_JSON line as instructed.`;
}
