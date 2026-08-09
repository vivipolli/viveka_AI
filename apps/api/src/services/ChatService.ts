import { v4 as uuidv4 } from "uuid";
import type { ChatStreamEvent, SourceReference } from "shared";
import {
  addMessage,
  conversationBelongsToSession,
  createConversation,
  ensureSession,
} from "../database/repositories/conversations.js";
import { getEmbeddingProvider } from "../providers/embedding/index.js";
import { getLLMProvider } from "../providers/llm/index.js";
import { findCachedAnswer, saveCachedAnswer } from "../rag/cache.js";
import { buildPrompt } from "../rag/prompt-builder.js";
import {
  buildReadingSuggestion,
  detectQuestionLanguage,
  filterCitationSources,
  notFoundMessage,
  primarySourceFromReferences,
} from "../rag/reading-suggestion.js";
import { retrieveChunks } from "../rag/retriever.js";
import { isPrimarySourceType } from "../rag/source-types.js";

export interface ChatParams {
  sessionId?: string;
  conversationId?: string;
  question: string;
}

/**
 * Orquestra o fluxo RAG: respostas objetivas + sugestao de leitura apontando
 * ao texto original do mestre (bibliotecaria inteligente, nao substituta).
 */
export async function* handleChat(
  params: ChatParams,
): AsyncIterable<ChatStreamEvent> {
  const question = params.question.trim();
  const sessionId = await ensureSession(params.sessionId);

  const conversationId = await resolveConversation(
    sessionId,
    params.conversationId,
    question,
  );

  const assistantMessageId = uuidv4();
  yield { type: "meta", conversationId, messageId: assistantMessageId };

  await addMessage({ conversationId, role: "user", content: question });

  const embedding = await getEmbeddingProvider().embed(question);
  const language = detectQuestionLanguage(question);

  const cached = await findCachedAnswer(embedding, language);
  if (cached && isCacheUsable(question, cached.sources)) {
    const sources = filterCitationSources(cached.sources);
    const readingSuggestion =
      cached.readingSuggestion ??
      buildReadingSuggestion(
        primarySourceFromReferences(sources),
        question,
      );

    yield { type: "cached", cached: true };
    yield { type: "token", value: cached.answer };
    if (readingSuggestion) {
      yield { type: "readingSuggestion", text: readingSuggestion };
    }
    if (sources.length > 0) {
      yield { type: "sources", sources };
    }
    await addMessage({
      id: assistantMessageId,
      conversationId,
      role: "assistant",
      content: cached.answer,
      sources,
      readingSuggestion,
    });
    yield { type: "done" };
    return;
  }

  const llm = getLLMProvider();
  const chunks = await retrieveChunks(
    embedding,
    question,
    llm.getMaxContextTokens(),
  );

  if (chunks.length === 0) {
    const message = notFoundMessage(question);
    yield { type: "token", value: message };
    await addMessage({
      id: assistantMessageId,
      conversationId,
      role: "assistant",
      content: message,
    });
    yield { type: "done" };
    return;
  }

  const prompt = buildPrompt(question, chunks);

  let answer = "";
  for await (const token of llm.generateStream({
    system: prompt.system,
    user: prompt.user,
  })) {
    answer += token;
    yield { type: "token", value: token };
  }

  const sources: SourceReference[] = prompt.sources;
  const readingSuggestion =
    prompt.readingSuggestion ??
    buildReadingSuggestion(
      primarySourceFromReferences(sources),
      question,
    );

  if (readingSuggestion) {
    yield { type: "readingSuggestion", text: readingSuggestion };
  }

  yield { type: "sources", sources };

  await addMessage({
    id: assistantMessageId,
    conversationId,
    role: "assistant",
    content: answer,
    sources,
    readingSuggestion,
  });

  await saveCachedAnswer({
    question,
    embedding,
    answer,
    sources,
    readingSuggestion,
    language,
  });

  yield { type: "done" };
}

async function resolveConversation(
  sessionId: string,
  conversationId: string | undefined,
  question: string,
): Promise<string> {
  if (
    conversationId &&
    (await conversationBelongsToSession(conversationId, sessionId))
  ) {
    return conversationId;
  }
  return createConversation(sessionId, question);
}

function isCacheUsable(question: string, sources: SourceReference[]): boolean {
  if (sources.some((source) => isPrimarySourceType(source.type))) return true;
  if (sources.length === 0) return true;

  const storyOnly = sources.every((source) => source.type === "story");
  if (!storyOnly) return true;

  return !/\b[\p{L}]{5,}\b/u.test(question);
}
