import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../../config.js";
import type { LLMGenerateParams, LLMProvider } from "./LLMProvider.js";

export class GeminiLLMProvider implements LLMProvider {
  readonly name = "gemini";
  private client: GoogleGenerativeAI;
  private model: string;

  constructor() {
    this.client = new GoogleGenerativeAI(config.geminiApiKey);
    this.model = config.geminiLlmModel;
  }

  async *generateStream(params: LLMGenerateParams): AsyncIterable<string> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: params.system,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: config.llmMaxOutputTokens,
      },
    });

    const result = await model.generateContentStream(params.user);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }

  getMaxContextTokens(): number {
    return 1_000_000;
  }
}
