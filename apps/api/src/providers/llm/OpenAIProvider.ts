import OpenAI from "openai";
import { config } from "../../config.js";
import type { LLMGenerateParams, LLMProvider } from "./LLMProvider.js";

export class OpenAILLMProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
    this.model = config.openaiLlmModel;
  }

  async *generateStream(params: LLMGenerateParams): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      temperature: params.temperature ?? 0.2,
      max_tokens: params.maxTokens ?? config.llmMaxOutputTokens,
      stream: true,
      messages: this.buildMessages(params),
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  async generateComplete(params: LLMGenerateParams): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: params.temperature ?? 0.2,
      max_tokens: params.maxTokens ?? config.llmMaxOutputTokens,
      stream: false,
      messages: this.buildMessages(params),
    });
    return response.choices[0]?.message?.content?.trim() ?? "";
  }

  getMaxContextTokens(): number {
    return 128_000;
  }

  private buildMessages(params: LLMGenerateParams) {
    const history = (params.history ?? []).map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));
    return [
      { role: "system" as const, content: params.system },
      ...history,
      { role: "user" as const, content: params.user },
    ];
  }
}
