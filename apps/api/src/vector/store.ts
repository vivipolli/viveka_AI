import { query, toVectorLiteral } from "../database/client.js";

export interface RetrievedChunk {
  id: string;
  documentId: string;
  content: string;
  title: string;
  author: string | null;
  chapter: string | null;
  page: number | null;
  year: number | null;
  type: string;
  vectorScore: number;
  textScore: number;
}

export interface ChunkInsert {
  documentId: string;
  content: string;
  embedding: number[];
  chapter: string | null;
  page: number | null;
  chunkIndex: number;
}

/** Insere chunks com seus embeddings em lote. */
export async function insertChunks(chunks: ChunkInsert[]): Promise<void> {
  for (const chunk of chunks) {
    await query(
      `INSERT INTO document_chunks
         (document_id, content, embedding, chapter, page, chunk_index)
       VALUES ($1, $2, $3::vector, $4, $5, $6)`,
      [
        chunk.documentId,
        chunk.content,
        toVectorLiteral(chunk.embedding),
        chunk.chapter,
        chunk.page,
        chunk.chunkIndex,
      ],
    );
  }
}

export interface HybridSearchOptions {
  types?: string[];
  excludeTypes?: string[];
}

function buildDocumentTypeFilter(
  options: HybridSearchOptions | undefined,
  paramIndex: number,
): { clause: string; params: string[][] } {
  if (options?.types?.length) {
    return {
      clause: `AND d.type = ANY($${paramIndex}::text[])`,
      params: [options.types],
    };
  }
  if (options?.excludeTypes?.length) {
    return {
      clause: `AND d.type <> ALL($${paramIndex}::text[])`,
      params: [options.excludeTypes],
    };
  }
  return { clause: "", params: [] };
}

/**
 * Busca hibrida: combina similaridade vetorial (pgvector) e full-text
 * (tsvector) em uma unica consulta, retornando os candidatos brutos.
 */
export async function hybridSearchRaw(
  embedding: number[],
  questionText: string,
  candidateLimit: number,
  options?: HybridSearchOptions,
): Promise<RetrievedChunk[]> {
  const typeFilter = buildDocumentTypeFilter(options, 4);
  const params: unknown[] = [
    toVectorLiteral(embedding),
    questionText,
    candidateLimit,
    ...typeFilter.params,
  ];

  const result = await query<RetrievedChunk & { vectorscore: number; textscore: number }>(
    `WITH vector_search AS (
       SELECT c.id, 1 - (c.embedding <=> $1::vector) AS vscore
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.embedding IS NOT NULL
         AND d.status = 'indexed'
         ${typeFilter.clause}
       ORDER BY c.embedding <=> $1::vector
       LIMIT $3
     ),
     text_search AS (
       SELECT c.id,
              ts_rank(c.content_tsv, plainto_tsquery('simple', $2)) AS tscore
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.content_tsv @@ plainto_tsquery('simple', $2)
         AND d.status = 'indexed'
         ${typeFilter.clause}
       ORDER BY tscore DESC
       LIMIT $3
     ),
     combined AS (
       SELECT id FROM vector_search
       UNION
       SELECT id FROM text_search
     )
     SELECT c.id,
            c.document_id       AS "documentId",
            c.content,
            c.chapter,
            c.page,
            d.title,
            d.author,
            d.year,
            d.type,
            COALESCE(v.vscore, 0) AS "vectorScore",
            COALESCE(t.tscore, 0) AS "textScore"
     FROM combined cb
     JOIN document_chunks c ON c.id = cb.id
     JOIN documents d ON d.id = c.document_id
     LEFT JOIN vector_search v ON v.id = cb.id
     LEFT JOIN text_search t ON t.id = cb.id`,
    params,
  );

  return result.rows;
}

/** Remove todos os chunks de um documento (usado no reprocessamento). */
export async function deleteChunksByDocument(documentId: string): Promise<void> {
  await query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);
}

/** Reconstroi o indice vetorial ivfflat. */
export async function rebuildVectorIndex(): Promise<void> {
  await query(`REINDEX INDEX document_chunks_embedding_idx`);
  await query(`REINDEX INDEX document_chunks_tsv_idx`);
}
