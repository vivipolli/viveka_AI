/**
 * Estimativa aproximada de tokens sem dependencia pesada de tokenizer.
 * ~4 caracteres por token e uma heuristica suficiente para controlar o
 * limite de contexto do RAG com margem de seguranca.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
