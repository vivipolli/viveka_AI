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
      temperature: 0.2,
      max_tokens: config.llmMaxOutputTokens,
      stream: true,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  getMaxContextTokens(): number {
    return 128_000;
  }
}
