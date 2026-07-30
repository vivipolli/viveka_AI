import type { FastifyInstance } from "fastify";
import type { FeedbackRequest } from "shared";
import { saveFeedback } from "../database/repositories/feedback.js";

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/feedback", async (request, reply) => {
    const body = request.body as FeedbackRequest;
    if (!body?.question || (body.rating !== 1 && body.rating !== -1)) {
      return reply.code(400).send({ error: "invalid feedback" });
    }
    await saveFeedback(body.question, body.rating);
    return { ok: true };
  });
}
