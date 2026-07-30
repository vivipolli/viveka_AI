import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const UPLOAD_DIR = join(apiRoot, "uploads");

export async function saveUpload(
  documentId: string,
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = extname(fileName) || ".pdf";
  const filePath = join(UPLOAD_DIR, `${documentId}${ext}`);
  await writeFile(filePath, buffer);
  return filePath;
}

export async function readUpload(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

export async function deleteUpload(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // File may already be missing.
  }
}

export function uploadFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? "document.pdf";
}
