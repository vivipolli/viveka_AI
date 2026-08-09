import type { DocumentType, SourceReference, SupportedLanguage } from "shared";

export interface PrimarySource {
  documentId: string;
  title: string;
  author?: string;
  chapter?: string;
  page?: number;
  type: DocumentType;
}

const BENGALI_SCRIPT = /[\u0980-\u09FF]/;

const PORTUGUESE_WORDS =
  /\b(não|nao|você|voce|estou|está|esta|são|sinto|sozinha|muito|também|tambem|porque|quando|como|minha|minhas|ainda|prefiro|solidão|solidao|desconforto|pessoas|conversas|profundamente|interesse|também|ser|uma|com|para|mas|me|do|da|dos|das|estou|estamos)\b/i;

const SPANISH_WORDS =
  /\b(qué|que|cómo|como|cuál|cual|por qué|dónde|donde|cuando|estoy|siento|también|muy|soledad|prefiero|personas|conversaciones|profundamente|interés|interes)\b/i;

const ENGLISH_WORDS =
  /\b(the|and|or|but|with|from|about|what|how|why|when|where|which|who|does|do|did|is|are|was|were|am|be|been|have|has|had|will|would|could|should|can|may|might|must|i|you|he|she|it|we|they|me|my|your|his|her|its|our|their|this|that|these|those|feel|feeling|alone|sometimes|often|people|deeply|connect|prefer|home|interest|superficial|uncomfortable|anyone|many|not|don't|doesn't|can't|won't|isn't|aren't|i'm|you're|it's|that's|there's|being|without|really|just|even|though|while|because|something|anything|everything)\b/i;

/** Heuristica simples para alinhar a sugestao de leitura ao idioma da pergunta. */
export function detectQuestionLanguage(text: string): SupportedLanguage {
  if (BENGALI_SCRIPT.test(text)) return "bn";

  const lower = text.toLowerCase();
  const hasPtAccents = /[ãõáéíóúâêôç]/.test(lower);
  const hasPortuguese = hasPtAccents || PORTUGUESE_WORDS.test(lower);
  const hasSpanish = /[¿¡]/.test(text) || SPANISH_WORDS.test(lower);
  const hasEnglish = ENGLISH_WORDS.test(lower);

  if (hasPortuguese && !hasEnglish && !hasSpanish) return "pt";
  if (hasSpanish && !hasPortuguese) return "es";
  if (hasEnglish && !hasPortuguese && !hasSpanish) return "en";
  if (hasPortuguese) return "pt";
  if (hasSpanish) return "es";
  if (hasEnglish) return "en";

  if (/^[a-z0-9\s.,!?;:'"()\-]+$/i.test(text.trim())) return "en";

  return "pt";
}

function labelsFor(lang: SupportedLanguage) {
  switch (lang) {
    case "en":
      return { chapter: "chapter", page: "page", book: "the book", of: "of" };
    case "es":
      return { chapter: "capítulo", page: "página", book: "el libro", of: "de" };
    case "bn":
      return { chapter: "অধ্যায়", page: "পৃষ্ঠা", book: "বই", of: "—" };
    default:
      return { chapter: "capítulo", page: "página", book: "o livro", of: "do" };
  }
}

function formatRef(source: PrimarySource, lang: SupportedLanguage): string {
  if (source.type === "story") {
    if (lang === "en") {
      return source.author
        ? `the story "${source.title}", as told by ${source.author}`
        : `the story "${source.title}"`;
    }
    if (lang === "es") {
      return source.author
        ? `la historia "${source.title}", contada por ${source.author}`
        : `la historia "${source.title}"`;
    }
    if (lang === "bn") {
      return source.author
        ? `"${source.title}" গল্পটি, ${source.author} কর্তৃক বর্ণিত`
        : `"${source.title}" গল্পটি`;
    }
    return source.author
      ? `a história "${source.title}", contada por ${source.author}`
      : `a história "${source.title}"`;
  }

  const { chapter, page, book, of: ofWord } = labelsFor(lang);
  const parts: string[] = [];

  if (source.chapter) {
    parts.push(`${chapter} ${source.chapter}`);
  }

  if (source.page != null) {
    parts.push(`${page} ${source.page}`);
  }

  const location = parts.length > 0 ? parts.join(", ") : null;

  if (source.type === "pdf") {
    if (lang === "bn") {
      return location
        ? `${book} ${source.title} এর ${location}`
        : `${book} ${source.title}`;
    }
    return location
      ? `${location} ${ofWord} ${book} ${source.title}`
      : `${book} ${source.title}`;
  }

  return location ? `${source.title}, ${location}` : source.title;
}

const NOT_FOUND_MESSAGES: Record<SupportedLanguage, string> = {
  pt: "Não encontrei essa informação no material disponível.",
  en: "This was not found in the available material.",
  es: "No se encontró esta información en el material disponible.",
  bn: "উপলব্ধ উপাদানে এই তথ্য পাওয়া যায়নি।",
};

export function notFoundMessage(question: string): string {
  return NOT_FOUND_MESSAGES[detectQuestionLanguage(question)];
}

const TEMPLATES: Record<SupportedLanguage, string> = {
  pt: "Esta resposta foi baseada principalmente em {ref}. Talvez a leitura direta desse trecho aprofunde sua compreensão.",
  en: "This answer was based mainly on {ref}. Reading that passage directly might deepen your understanding.",
  es: "Esta respuesta se basó principalmente en {ref}. Quizás la lectura directa de ese fragmento profundice su comprensión.",
  bn: "এই উত্তর প্রধানত {ref} থেকে নেওয়া হয়েছে। সরাসরি এই অংশ পড়লে আপনার বোঝাপড়া আরও গভীর হতে পারে।",
};

/** Gera sugestao de leitura apontando ao livro (PDF) usado na resposta. */
export function buildReadingSuggestion(
  source: PrimarySource | undefined,
  question: string,
): string | undefined {
  if (!source || source.type !== "pdf") return undefined;
  const lang = detectQuestionLanguage(question);
  const ref = formatRef(source, lang);
  return TEMPLATES[lang].replace("{ref}", ref);
}

export function primarySourceFromReferences(
  sources: SourceReference[],
): PrimarySource | undefined {
  const top = sources[0];
  if (!top) return undefined;
  return toPrimarySource(top);
}

function toPrimarySource(source: SourceReference): PrimarySource {
  return {
    documentId: source.documentId,
    title: source.title,
    author: source.author,
    chapter: source.chapter,
    page: source.page,
    type: source.type,
  };
}

/**
 * Sugestao de leitura so para respostas baseadas em livro (PDF).
 * Historias, citacoes e transcricoes aparecem apenas em Fontes.
 */
export function resolveReadingSuggestion(
  sources: SourceReference[],
  llmSuggestion: string | undefined,
  question: string,
): string | undefined {
  const bookSource = sources.find((source) => source.type === "pdf");
  if (!bookSource) return undefined;

  if (llmSuggestion?.trim()) {
    return llmSuggestion.trim();
  }

  return buildReadingSuggestion(toPrimarySource(bookSource), question);
}
