import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ChatRequest, ChatStreamEvent } from "shared";
import { config } from "../config.js";
import { checkAndConsume } from "../database/repositories/rateLimit.js";
import {
  ensureSession,
  listConversations,
  listMessages,
  conversationBelongsToSession,
} from "../database/repositories/conversations.js";
import { handleChat } from "../services/ChatService.js";

function writeEvent(reply: FastifyReply, event: ChatStreamEvent): void {
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
}

function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return request.ip;
}

function sseHeaders(request: FastifyRequest): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };

  const origin = request.headers.origin;
  if (typeof origin === "string" && config.corsOrigin.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/session", async () => {
    const sessionId = await ensureSession();
    return { sessionId };
  });

  app.get("/api/conversations", async (request) => {
    const { sessionId } = request.query as { sessionId?: string };
    if (!sessionId) return { conversations: [] };
    return { conversations: await listConversations(sessionId) };
  });

  app.get("/api/conversations/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { sessionId } = request.query as { sessionId?: string };
    if (!sessionId || !(await conversationBelongsToSession(id, sessionId))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    return { messages: await listMessages(id) };
  });

  app.post("/api/chat", async (request, reply) => {
    const body = request.body as ChatRequest;
    if (!body?.question || body.question.trim().length === 0) {
      return reply.code(400).send({ error: "question is required" });
    }

    const ip = getClientIp(request);
    const limit = await checkAndConsume(ip);
    if (!limit.allowed) {
      return reply.code(429).send({ error: "rate_limit_exceeded" });
    }

    reply.raw.writeHead(200, sseHeaders(request));

    try {
      for await (const event of handleChat({
        sessionId: body.sessionId,
        conversationId: body.conversationId,
        question: body.question,
      })) {
        writeEvent(reply, event);
      }
    } catch (err) {
      app.log.error(err);
      writeEvent(reply, {
        type: "error",
        message: "Erro ao gerar resposta. Tente novamente.",
      });
    } finally {
      reply.raw.end();
    }
  });
}
