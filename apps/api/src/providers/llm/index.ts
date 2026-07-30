import { config } from "../../config.js";
import { ClaudeLLMProvider } from "./ClaudeProvider.js";
import { GeminiLLMProvider } from "./GeminiProvider.js";
import type { LLMProvider } from "./LLMProvider.js";
import { OpenAILLMProvider } from "./OpenAIProvider.js";

let instance: LLMProvider | null = null;

/** Retorna o provider de LLM ativo conforme LLM_PROVIDER (singleton). */
export function getLLMProvider(): LLMProvider {
  if (instance) return instance;

  switch (config.llmProvider) {
    case "gemini":
      instance = new GeminiLLMProvider();
      break;
    case "claude":
      instance = new ClaudeLLMProvider();
      break;
    case "openai":
    default:
      instance = new OpenAILLMProvider();
      break;
  }

  return instance;
}

export type { LLMProvider } from "./LLMProvider.js";
