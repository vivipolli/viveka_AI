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

/** Heuristica simples para alinhar a sugestao de leitura ao idioma da pergunta. */
export function detectQuestionLanguage(text: string): SupportedLanguage {
  if (BENGALI_SCRIPT.test(text)) return "bn";

  const lower = text.toLowerCase();
  const hasPtAccents = /[ãõáéíóúâêôç]/.test(lower);
  const hasSpanish =
    /[¿¡]/.test(text) ||
    /\b(qué|cómo|cuál|por qué|dónde|cuando)\b/.test(lower);
  const hasEnglish = /\b(the|what|how|why|when|where|which|does|is|are)\b/.test(
    lower,
  );

  if (hasSpanish && !hasPtAccents) return "es";
  if (hasEnglish && !hasPtAccents && !hasSpanish) return "en";
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

/** Gera sugestao de leitura apontando a fonte principal (trecho mais relevante). */
export function buildReadingSuggestion(
  source: PrimarySource | undefined,
  question: string,
): string | undefined {
  if (!source) return undefined;
  const lang = detectQuestionLanguage(question);
  const ref = formatRef(source, lang);
  return TEMPLATES[lang].replace("{ref}", ref);
}

export function primarySourceFromChunks(
  chunks: Array<{
    documentId: string;
    title: string;
    author?: string | null;
    chapter?: string | null;
    page?: number | null;
    type: string;
  }>,
): PrimarySource | undefined {
  const story = chunks.find((chunk) => chunk.type === "story");
  const top = story ?? chunks[0];
  if (!top) return undefined;
  return {
    documentId: top.documentId,
    title: top.title,
    author: top.author ?? undefined,
    chapter: top.chapter ?? undefined,
    page: top.page ?? undefined,
    type: top.type as DocumentType,
  };
}

export function primarySourceFromReferences(
  sources: SourceReference[],
): PrimarySource | undefined {
  const story = sources.find((source) => source.type === "story");
  const top = story ?? sources[0];
  if (!top) return undefined;
  return {
    documentId: top.documentId,
    title: top.title,
    author: top.author,
    chapter: top.chapter,
    page: top.page,
    type: top.type,
  };
}

/** Reduz fontes salvas em cache para a principal (e no maximo mais uma). */
export function filterCitationSources(
  sources: SourceReference[],
): SourceReference[] {
  if (sources.length === 0) return [];

  const primary = primarySourceFromReferences(sources);
  if (!primary) return sources.slice(0, 1);

  const primaryRef =
    sources.find(
      (source) =>
        source.documentId === primary.documentId &&
        (source.chapter ?? "") === (primary.chapter ?? "") &&
        (source.page ?? null) === (primary.page ?? null),
    ) ?? sources.find((source) => source.documentId === primary.documentId);

  if (!primaryRef) return [];

  const secondary = sources.find(
    (source) => source.documentId !== primary.documentId,
  );

  return secondary ? [primaryRef, secondary] : [primaryRef];
}
