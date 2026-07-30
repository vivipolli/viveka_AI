import OpenAI from "openai";
import { config } from "../../config.js";
import type { EmbeddingProvider } from "./EmbeddingProvider.js";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
    this.model = config.openaiEmbeddingModel;
  }

  async embed(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text]);
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data.map((item) => item.embedding);
  }

  getDimensions(): number {
    return config.embeddingDimensions;
  }
}
