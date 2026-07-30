import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config.js";
import type { LLMGenerateParams, LLMProvider } from "./LLMProvider.js";

export class ClaudeLLMProvider implements LLMProvider {
  readonly name = "claude";
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    this.model = config.claudeLlmModel;
  }

  async *generateStream(params: LLMGenerateParams): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: config.llmMaxOutputTokens,
      temperature: 0.2,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }

  getMaxContextTokens(): number {
    return 200_000;
  }
}
