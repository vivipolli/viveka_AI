import { config } from "../config.js";
import { pool, query } from "../database/client.js";

/**
 * Remove conversas, mensagens, sessoes e cache mais antigos que o periodo
 * de retencao. Feedback e a base de conhecimento sao preservados.
 */
export async function cleanupOldData(): Promise<{ deletedSessions: number }> {
  const days = config.conversationRetentionDays;
  const interval = `${days} days`;

  await query(
    `DELETE FROM response_cache WHERE created_at < NOW() - $1::interval`,
    [interval],
  );

  const result = await query(
    `DELETE FROM sessions WHERE created_at < NOW() - $1::interval`,
    [interval],
  );

  return { deletedSessions: result.rowCount ?? 0 };
}

const isEntry =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isEntry) {
  cleanupOldData()
    .then((r) => {
      console.log(`Cleanup done. Removed ${r.deletedSessions} old sessions.`);
      return pool.end();
    })
    .catch((err) => {
      console.error("Cleanup failed:", err);
      process.exit(1);
    });
}
