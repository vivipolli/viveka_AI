import { v4 as uuidv4 } from "uuid";
import type { ChatStreamEvent } from "shared";
import {
  addMessage,
  conversationBelongsToSession,
  createConversation,
  ensureSession,
} from "../database/repositories/conversations.js";
import { getEmbeddingProvider } from "../providers/embedding/index.js";
import { getLLMProvider } from "../providers/llm/index.js";
import { findCachedAnswer, saveCachedAnswer } from "../rag/cache.js";
import {
  consumeStreamToken,
  createStreamParseState,
  parseChatResponse,
  resolveSourcesFromIndices,
} from "../rag/citation-parser.js";
import { buildPrompt } from "../rag/prompt-builder.js";
import {
  buildReadingSuggestion,
  notFoundMessage,
  primarySourceFromReferences,
} from "../rag/reading-suggestion.js";
import { retrieveChunks } from "../rag/retriever.js";

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

  const cached = await findCachedAnswer(embedding);
  if (cached) {
    const readingSuggestion =
      cached.readingSuggestion ??
      (cached.sources.length > 0
        ? buildReadingSuggestion(
            primarySourceFromReferences(cached.sources),
            question,
          )
        : undefined);

    yield { type: "cached", cached: true };
    yield { type: "token", value: cached.answer };
    if (readingSuggestion) {
      yield { type: "readingSuggestion", text: readingSuggestion };
    }
    if (cached.sources.length > 0) {
      yield { type: "sources", sources: cached.sources };
    }
    await addMessage({
      id: assistantMessageId,
      conversationId,
      role: "assistant",
      content: cached.answer,
      sources: cached.sources,
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
  const streamState = createStreamParseState();

  for await (const token of llm.generateStream({
    system: prompt.system,
    user: prompt.user,
  })) {
    const visible = consumeStreamToken(streamState, token);
    if (visible) {
      yield { type: "token", value: visible };
    }
  }

  const parsed = parseChatResponse(streamState.buffer);
  const sources = resolveSourcesFromIndices(parsed.usedSourceIndices, prompt.chunks);
  const readingSuggestion =
    parsed.readingSuggestion ??
    (sources.length > 0
      ? buildReadingSuggestion(primarySourceFromReferences(sources), question)
      : undefined);

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
    content: parsed.answer,
    sources,
    readingSuggestion,
  });

  await saveCachedAnswer({
    question,
    embedding,
    answer: parsed.answer,
    sources,
    readingSuggestion,
    language: "auto",
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
