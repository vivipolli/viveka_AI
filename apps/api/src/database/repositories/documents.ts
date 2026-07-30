import type {
  DocumentMetadata,
  DocumentStatus,
  DocumentType,
  SupportedLanguage,
} from "shared";
import { query } from "../client.js";

export interface CreateDocumentInput {
  title: string;
  author?: string;
  chapter?: string;
  page?: number;
  year?: number;
  type: DocumentType;
  language: SupportedLanguage;
  source?: string;
  filePath?: string;
}

export async function createDocument(
  input: CreateDocumentInput,
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO documents
       (title, author, chapter, page, year, type, language, source, file_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      input.title,
      input.author ?? null,
      input.chapter ?? null,
      input.page ?? null,
      input.year ?? null,
      input.type,
      input.language,
      input.source ?? null,
      input.filePath ?? null,
    ],
  );
  return result.rows[0].id;
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
  error?: string,
): Promise<void> {
  await query(`UPDATE documents SET status = $2, error = $3 WHERE id = $1`, [
    id,
    status,
    error ?? null,
  ]);
}

export async function listDocuments(): Promise<DocumentMetadata[]> {
  const result = await query<{
    id: string;
    title: string;
    author: string | null;
    chapter: string | null;
    page: number | null;
    year: number | null;
    type: DocumentType;
    language: SupportedLanguage;
    source: string | null;
    status: DocumentStatus;
    chunk_count: string;
    created_at: Date;
  }>(
    `SELECT d.id, d.title, d.author, d.chapter, d.page, d.year, d.type,
            d.language, d.source, d.status, d.created_at,
            COUNT(c.id) AS chunk_count
     FROM documents d
     LEFT JOIN document_chunks c ON c.document_id = d.id
     GROUP BY d.id
     ORDER BY d.created_at DESC`,
  );

  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    author: r.author ?? undefined,
    chapter: r.chapter ?? undefined,
    page: r.page ?? undefined,
    year: r.year ?? undefined,
    type: r.type,
    language: r.language,
    source: r.source ?? undefined,
    status: r.status,
    chunkCount: Number(r.chunk_count),
    createdAt: r.created_at.toISOString(),
  }));
}

export async function getDocument(id: string): Promise<DocumentMetadata | null> {
  const result = await query<{
    id: string;
    title: string;
    author: string | null;
    chapter: string | null;
    page: number | null;
    year: number | null;
    type: DocumentType;
    language: SupportedLanguage;
    source: string | null;
    status: DocumentStatus;
    created_at: Date;
  }>(
    `SELECT id, title, author, chapter, page, year, type, language, source,
            status, created_at
     FROM documents WHERE id = $1`,
    [id],
  );
  const r = result.rows[0];
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    author: r.author ?? undefined,
    chapter: r.chapter ?? undefined,
    page: r.page ?? undefined,
    year: r.year ?? undefined,
    type: r.type,
    language: r.language,
    source: r.source ?? undefined,
    status: r.status,
    createdAt: r.created_at.toISOString(),
  };
}

export async function deleteDocument(id: string): Promise<void> {
  await query(`DELETE FROM documents WHERE id = $1`, [id]);
}
