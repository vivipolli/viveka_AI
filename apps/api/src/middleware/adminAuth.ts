import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

/** preHandler que exige a senha de admin no header x-admin-password. */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const provided = request.headers["x-admin-password"];
  if (provided !== config.adminPassword) {
    reply.code(401).send({ error: "unauthorized" });
  }
}
