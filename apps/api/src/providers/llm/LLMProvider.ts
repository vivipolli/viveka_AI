export interface LLMGenerateParams {
  system: string;
  user: string;
  /** Idioma alvo (dica; o modelo tambem infere pela pergunta). */
  language?: string;
}

/**
 * Contrato generico para modelos de linguagem.
 * Implementacoes concretas (OpenAI, Gemini, Claude) sao intercambiaveis
 * via configuracao, sem alterar o restante da aplicacao.
 */
export interface LLMProvider {
  readonly name: string;
  /** Emite a resposta token a token para streaming SSE. */
  generateStream(params: LLMGenerateParams): AsyncIterable<string>;
  /** Limite de tokens de contexto suportado pelo modelo ativo. */
  getMaxContextTokens(): number;
}
