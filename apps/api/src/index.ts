import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { config } from "./config.js";
import { cleanupOldData } from "./jobs/cleanup.js";
import { adminRoutes } from "./routes/admin.js";
import { chatRoutes } from "./routes/chat.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { healthRoutes } from "./routes/health.js";

async function main() {
  const app = Fastify({
    logger: { level: config.nodeEnv === "development" ? "info" : "warn" },
  });

  await app.register(cors, {
    origin: config.corsOrigin,
    methods: ["GET", "POST", "DELETE"],
  });

  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024 },
  });

  await app.register(healthRoutes);
  await app.register(chatRoutes);
  await app.register(feedbackRoutes);
  await app.register(adminRoutes);

  scheduleDailyCleanup(app.log);

  await app.listen({ port: config.port, host: "0.0.0.0" });
}

/** Executa a limpeza de retencao uma vez por dia no proprio processo. */
function scheduleDailyCleanup(log: { info: (msg: string) => void; error: (err: unknown) => void }) {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const run = () => {
    cleanupOldData()
      .then((r) => log.info(`Retention cleanup removed ${r.deletedSessions} sessions`))
      .catch((err) => log.error(err));
  };
  setInterval(run, ONE_DAY).unref();
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
