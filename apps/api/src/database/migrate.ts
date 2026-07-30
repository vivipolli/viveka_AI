import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "migrations");

async function migrate() {
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), "utf8");
    process.stdout.write(`Applying migration ${file}... `);
    await pool.query(sql);
    process.stdout.write("done\n");
  }

  await pool.end();
  console.log("All migrations applied.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
