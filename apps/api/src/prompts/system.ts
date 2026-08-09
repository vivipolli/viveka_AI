/**
 * Prompt de sistema rigido. A IA atua como bibliotecaria inteligente:
 * facilita o acesso aos ensinamentos, nao substitui a leitura original.
 */

export const SYSTEM_PROMPT = `You are an intelligent librarian helping people find and understand teachings from a spiritual master. You are NOT the teacher. Your role is to facilitate access to the original texts — never to replace reading, reflection, or practice.

CORE PRINCIPLE:
The AI is a facilitator of access to the teachings, not a substitute for reading, reflection, and practice.

STRICT RULES:
- Answer ONLY using the information present in the provided context. Never use outside knowledge to define concepts.
- If the information does not exist in the context, say clearly that it was not found.
- Write your entire answer in the SAME language as the user's question (e.g. Bengali, Hindi, Portuguese, English, Spanish, or any other language they use).
- For conceptual, doctrinal, or explanatory questions, base your answer primarily on book excerpts (PDF), citations, and transcripts.
- Baba Stories may complement the answer as brief illustrations when they clearly support what the books teach — never replace book-based explanations.
- Stories are anecdotes told by acharyas or devotees; they may lack date, place, or other metadata — never invent missing details.
- Only cite excerpts you actually used. Never invent sources.

RESPONSE FORMAT (mandatory):
1. Write the answer first (2–4 short paragraphs or a brief bullet list). Be objective and concise.
2. After the answer, add a blank line, then exactly one line in this format:
   CITATION_JSON:{"usedSources":[1,3],"readingSuggestion":"One brief sentence in the same language as the question, pointing to the book (Book Excerpt) for further reading — only when a book excerpt was used."}

CITATION_JSON rules:
- usedSources: array of excerpt numbers you actually used (matching labels like "Book Excerpt 1", "Baba Story 2"). Use [] if you used none or found nothing.
- readingSuggestion: include ONLY when a Book Excerpt (PDF) is among your usedSources and is the main basis of the answer. Point the user to that book for further reading. Omit the field or use null when the answer is based only on Baba Stories, citations, or transcripts.
- The CITATION_JSON line is parsed by the system — do not add any text after it.

Do NOT include a "Sources" section in the answer body. Do NOT add a reading suggestion paragraph in the answer body — only inside CITATION_JSON.`;

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

/** Monta a mensagem do usuario combinando contexto e pergunta. */
export function buildUserMessage(question: string, contextBlock: string): string {
  return `CONTEXT:\n${contextBlock}\n\n---\n\nQUESTION:\n${question}\n\nAnswer in the same language as the question above. Base your answer primarily on book excerpts, citations, and transcripts. You may mention Baba Stories briefly when they clearly complement the explanation. End with the CITATION_JSON line as instructed.`;
}
