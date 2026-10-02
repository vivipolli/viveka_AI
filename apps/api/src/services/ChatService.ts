import { v4 as uuidv4 } from "uuid";
import type { ChatStreamEvent } from "shared";
import {
  addMessage,
  conversationBelongsToSession,
  createConversation,
  ensureSession,
  listMessages,
} from "../database/repositories/conversations.js";
import { getEmbeddingProvider } from "../providers/embedding/index.js";
import type { EmbeddingProvider } from "../providers/embedding/EmbeddingProvider.js";
import { getLLMProvider } from "../providers/llm/index.js";
import type { ChatTurn } from "../providers/llm/LLMProvider.js";
import { findCachedAnswer, saveCachedAnswer } from "../rag/cache.js";
import {
  consumeStreamToken,
  createStreamParseState,
  parseChatResponse,
  resolveSourcesFromIndices,
} from "../rag/citation-parser.js";
import {
  buildPrompt,
  buildRetrievalQuery,
  shouldEnrichRetrieval,
  topicAnchorTexts,
} from "../rag/prompt-builder.js";
import {
  notFoundMessage,
  resolveReadingSuggestion,
} from "../rag/reading-suggestion.js";
import { retrieveChunks } from "../rag/retriever.js";

export interface ChatParams {
  sessionId?: string;
  conversationId?: string;
  question: string;
}

/** Maximo de turnos anteriores enviados ao LLM (user + assistant). */
const MAX_HISTORY_TURNS = 8;

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

  const priorHistory = await loadConversationHistory(conversationId);

  await addMessage({ conversationId, role: "user", content: question });

  const embedder = getEmbeddingProvider();
  const questionEmbedding = await embedder.embed(question);
  const sameTopic = await isSameTopic(questionEmbedding, priorHistory, embedder);
  const retrievalText = sameTopic
    ? buildRetrievalQuery(question, priorHistory)
    : question;
  const embedding = sameTopic
    ? await embedder.embed(retrievalText)
    : questionEmbedding;

  // Cache semantico so em conversas novas; follow-ups dependem do historico.
  if (priorHistory.length === 0) {
    const cached = await findCachedAnswer(embedding);
    if (cached) {
      const readingSuggestion = resolveReadingSuggestion(
        cached.sources,
        cached.readingSuggestion,
        question,
      );

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
  }

  const llm = getLLMProvider();
  const chunks = await retrieveChunks(
    embedding,
    retrievalText,
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

  const prompt = buildPrompt(question, chunks, priorHistory);
  const streamState = createStreamParseState();

  for await (const token of llm.generateStream({
    system: prompt.system,
    user: prompt.user,
    history: prompt.history,
  })) {
    const visible = consumeStreamToken(streamState, token);
    if (visible) {
      yield { type: "token", value: visible };
    }
  }

  const parsed = parseChatResponse(streamState.buffer);
  const sources = resolveSourcesFromIndices(parsed.usedSourceIndices, prompt.chunks);
  const readingSuggestion = resolveReadingSuggestion(
    sources,
    parsed.readingSuggestion,
    question,
  );

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

  // So cacheia respostas de turnos isolados (sem historico).
  if (priorHistory.length === 0) {
    await saveCachedAnswer({
      question,
      embedding,
      answer: parsed.answer,
      sources,
      readingSuggestion,
      language: "auto",
    });
  }

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

async function loadConversationHistory(
  conversationId: string,
): Promise<ChatTurn[]> {
  const messages = await listMessages(conversationId);
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-MAX_HISTORY_TURNS)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

/**
 * Continua o mesmo tema se a pergunta atual for semanticamente proxima
 * da ultima pergunta ou da ultima resposta — independente do idioma.
 */
async function isSameTopic(
  questionEmbedding: number[],
  history: ChatTurn[],
  embedder: EmbeddingProvider,
): Promise<boolean> {
  const anchors = topicAnchorTexts(history);
  if (anchors.length === 0) return false;

  const anchorEmbeddings = await embedder.embedBatch(anchors);
  return shouldEnrichRetrieval(questionEmbedding, anchorEmbeddings);
}
