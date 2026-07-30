import { config } from "../../config.js";
import { query } from "../client.js";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Controla o numero de perguntas por IP dentro da janela configurada.
 * A janela reinicia automaticamente quando expira.
 */
export async function checkAndConsume(ip: string): Promise<RateLimitResult> {
  const windowSeconds = config.rateLimitWindow;
  const max = config.rateLimitMax;

  const result = await query<{ count: number }>(
    `INSERT INTO rate_limits (ip, count, window_start)
     VALUES ($1, 1, NOW())
     ON CONFLICT (ip) DO UPDATE SET
       count = CASE
                 WHEN rate_limits.window_start < NOW() - ($2 || ' seconds')::interval
                 THEN 1
                 ELSE rate_limits.count + 1
               END,
       window_start = CASE
                        WHEN rate_limits.window_start < NOW() - ($2 || ' seconds')::interval
                        THEN NOW()
                        ELSE rate_limits.window_start
                      END
     RETURNING count`,
    [ip, String(windowSeconds)],
  );

  const count = result.rows[0].count;
  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
  };
}
