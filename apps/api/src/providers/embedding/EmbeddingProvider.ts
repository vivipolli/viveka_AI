/**
 * Contrato generico para geracao de embeddings.
 * Permite trocar OpenAI por outro provider sem alterar o pipeline RAG.
 */
export interface EmbeddingProvider {
  readonly name: string;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
}
