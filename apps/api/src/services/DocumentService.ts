import { query, toVectorLiteral } from "../database/client.js";
import {
  createDocument,
  updateDocumentStatus,
  type CreateDocumentInput,
} from "../database/repositories/documents.js";
import { getEmbeddingProvider } from "../providers/embedding/index.js";
import { chunkText } from "../rag/chunker.js";
import { deleteChunksByDocument, insertChunks } from "../vector/store.js";

/**
 * Ingesta um documento: cria o registro, divide em chunks, gera embeddings
 * e indexa no pgvector. Marca o status como 'indexed' ou 'error'.
 */
export async function ingestDocument(
  input: CreateDocumentInput,
  rawText: string,
): Promise<string> {
  const documentId = await createDocument(input);

  try {
    await indexText(documentId, rawText, input.chapter ?? null, input.page ?? null);
    await updateDocumentStatus(documentId, "indexed");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateDocumentStatus(documentId, "error", message);
    throw err;
  }

  return documentId;
}

/**
 * Reprocessa os embeddings de um documento a partir do conteudo ja
 * armazenado nos chunks (sem precisar do arquivo original).
 */
export async function reprocessEmbeddings(documentId: string): Promise<void> {
  await updateDocumentStatus(documentId, "processing");
  try {
    const chunks = await query<{ id: string; content: string }>(
      `SELECT id, content FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index ASC`,
      [documentId],
    );

    const provider = getEmbeddingProvider();
    const embeddings = await provider.embedBatch(chunks.rows.map((c) => c.content));

    for (let i = 0; i < chunks.rows.length; i++) {
      await query(
        `UPDATE document_chunks SET embedding = $2::vector WHERE id = $1`,
        [chunks.rows[i].id, toVectorLiteral(embeddings[i])],
      );
    }

    await updateDocumentStatus(documentId, "indexed");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateDocumentStatus(documentId, "error", message);
    throw err;
  }
}

async function indexText(
  documentId: string,
  rawText: string,
  chapter: string | null,
  page: number | null,
): Promise<void> {
  const chunks = chunkText(rawText);
  if (chunks.length === 0) {
    throw new Error("Documento vazio ou sem texto extraivel");
  }

  const provider = getEmbeddingProvider();
  const embeddings = await provider.embedBatch(chunks.map((c) => c.content));

  await insertChunks(
    chunks.map((chunk, i) => ({
      documentId,
      content: chunk.content,
      embedding: embeddings[i],
      chapter,
      page,
      chunkIndex: chunk.index,
    })),
  );
}

export async function getChunkPreview(
  documentId: string,
  limit = 5,
): Promise<{ index: number; content: string }[]> {
  const result = await query<{ chunk_index: number; content: string }>(
    `SELECT chunk_index, content FROM document_chunks
     WHERE document_id = $1 ORDER BY chunk_index ASC LIMIT $2`,
    [documentId, limit],
  );
  return result.rows.map((r) => ({ index: r.chunk_index, content: r.content }));
}

export { deleteChunksByDocument };
