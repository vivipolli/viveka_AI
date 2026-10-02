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
    const chat = this.startChat(params);
    const result = await chat.sendMessageStream(params.user);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }

  async generateComplete(params: LLMGenerateParams): Promise<string> {
    const chat = this.startChat(params);
    const result = await chat.sendMessage(params.user);
    return result.response.text().trim();
  }

  getMaxContextTokens(): number {
    return 1_000_000;
  }

  private startChat(params: LLMGenerateParams) {
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: params.system,
      generationConfig: {
        temperature: params.temperature ?? 0.2,
        maxOutputTokens: params.maxTokens ?? config.llmMaxOutputTokens,
      },
    });

    const history = (params.history ?? []).map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    }));

    return model.startChat({ history });
  }
}
