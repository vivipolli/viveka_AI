export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface LLMGenerateParams {
  system: string;
  user: string;
  /** Turnos anteriores da mesma conversa (sem a pergunta atual). */
  history?: ChatTurn[];
  /** Idioma alvo (dica; o modelo tambem infere pela pergunta). */
  language?: string;
  /** Override do limite de tokens de saida (ex.: resolver curto). */
  maxTokens?: number;
  temperature?: number;
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
  /** Resposta completa (nao streaming), para tarefas curtas auxiliares. */
  generateComplete(params: LLMGenerateParams): Promise<string>;
  /** Limite de tokens de contexto suportado pelo modelo ativo. */
  getMaxContextTokens(): number;
}
