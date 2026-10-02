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
    const history = (params.history ?? []).map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: params.maxTokens ?? config.llmMaxOutputTokens,
      temperature: params.temperature ?? 0.2,
      system: params.system,
      messages: [...history, { role: "user", content: params.user }],
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

  async generateComplete(params: LLMGenerateParams): Promise<string> {
    const history = (params.history ?? []).map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? config.llmMaxOutputTokens,
      temperature: params.temperature ?? 0.2,
      system: params.system,
      messages: [...history, { role: "user", content: params.user }],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    return text.trim();
  }

  getMaxContextTokens(): number {
    return 200_000;
  }
}
