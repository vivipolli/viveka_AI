/** Normaliza espacos em branco e remove linhas vazias excessivas. */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Cria um trecho curto para exibicao em citacoes de fonte. */
export function makeExcerpt(text: string, maxLength = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trimEnd()}...`;
}
