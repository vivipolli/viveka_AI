import type { FastifyInstance } from "fastify";
import { query } from "../database/client.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => {
    await query("SELECT 1");
    return { status: "ok" };
  });
}
