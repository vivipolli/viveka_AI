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
import { getLLMProvider } from "../providers/llm/index.js";
import type { ChatTurn } from "../providers/llm/LLMProvider.js";
import { findCachedAnswer, saveCachedAnswer } from "../rag/cache.js";
import {
  consumeStreamToken,
  createStreamParseState,
  parseChatResponse,
  resolveSourcesFromIndices,
} from "../rag/citation-parser.js";
import { buildPrompt } from "../rag/prompt-builder.js";
import { resolveSearchQuery } from "../rag/query-resolver.js";
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

  const llm = getLLMProvider();
  const embedder = getEmbeddingProvider();

  // A propria IA decide continuidade e reescreve a query de busca se preciso.
  const resolved =
    priorHistory.length > 0
      ? await resolveSearchQuery(question, priorHistory, llm)
      : { searchQuery: question, continuesPrevious: false };

  // Busca e resposta usam a pergunta resolvida (follow-up vira pergunta autonoma).
  const answerQuestion = resolved.searchQuery;
  const retrievalText = resolved.continuesPrevious
    ? anchorRetrievalQuery(resolved.searchQuery, priorHistory)
    : resolved.searchQuery;
  const embedding = await embedder.embed(retrievalText);

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

  const prompt = buildPrompt(answerQuestion, chunks, priorHistory);
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
 * Ancora a busca no topico das perguntas anteriores do usuario, para o
 * embedding nao ser dominado so pelo filtro curto do follow-up.
 */
function anchorRetrievalQuery(
  searchQuery: string,
  history: ChatTurn[],
): string {
  const priorUsers = history
    .filter((turn) => turn.role === "user")
    .slice(-2)
    .map((turn) => turn.content.trim())
    .filter(Boolean);

  if (priorUsers.length === 0) return searchQuery;
  return `${priorUsers.join(" | ")} | ${searchQuery}`;
}
