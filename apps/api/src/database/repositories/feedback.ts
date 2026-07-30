import { query } from "../client.js";

/** Salva apenas pergunta, avaliacao e timestamp. Sem dados pessoais. */
export async function saveFeedback(
  question: string,
  rating: 1 | -1,
): Promise<void> {
  await query(`INSERT INTO feedback (question, rating) VALUES ($1, $2)`, [
    question,
    rating,
  ]);
}
