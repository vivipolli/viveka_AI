import type { FastifyInstance } from "fastify";
import type { DocumentType, SupportedLanguage } from "shared";
import { DOCUMENT_TYPES } from "shared";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import {
  deleteDocument,
  getDocument,
  getDocumentFilePath,
  listDocuments,
  updateDocumentFilePath,
} from "../database/repositories/documents.js";
import {
  getChunkPreview,
  ingestDocument,
  reprocessEmbeddings,
} from "../services/DocumentService.js";
import { readUpload, saveUpload } from "../lib/uploads.js";
import { rebuildVectorIndex } from "../vector/store.js";

const VALID_TYPES = DOCUMENT_TYPES;
const VALID_LANGUAGES: SupportedLanguage[] = ["pt", "en", "es", "bn"];

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  app.post("/api/admin/login", async () => ({ ok: true }));

  app.get("/api/admin/documents", async () => ({
    documents: await listDocuments(),
  }));

  app.get("/api/admin/documents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await getDocument(id);
    if (!doc) return reply.code(404).send({ error: "not found" });
    return { document: doc };
  });

  app.get("/api/admin/documents/:id/download", async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await getDocument(id);
    if (!doc) return reply.code(404).send({ error: "not found" });
    if (doc.type !== "pdf" || !doc.hasFile) {
      return reply.code(404).send({ error: "file not available" });
    }

    const filePath = await getDocumentFilePath(id);
    if (!filePath) return reply.code(404).send({ error: "file not found" });

    const buffer = await readUpload(filePath);
    const safeName = `${doc.title.replace(/[^\w\s.-]/g, "").trim() || "document"}.pdf`;

    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="${safeName}"`)
      .send(buffer);
  });

  app.get("/api/admin/documents/:id/chunks", async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await getDocument(id);
    if (!doc) return reply.code(404).send({ error: "not found" });
    return { chunks: await getChunkPreview(id) };
  });

  app.post("/api/admin/documents/:id/reprocess", async (request) => {
    const { id } = request.params as { id: string };
    await reprocessEmbeddings(id);
    return { ok: true };
  });

  app.delete("/api/admin/documents/:id", async (request) => {
    const { id } = request.params as { id: string };
    await deleteDocument(id);
    return { ok: true };
  });

  app.post("/api/admin/reindex", async () => {
    await rebuildVectorIndex();
    return { ok: true };
  });

  // Importa documento via texto puro (JSON).
  app.post("/api/admin/documents/text", async (request, reply) => {
    const body = request.body as {
      title?: string;
      author?: string;
      chapter?: string;
      page?: number;
      year?: number;
      type?: DocumentType;
      language?: SupportedLanguage;
      source?: string;
      content?: string;
    };

    if (!body?.title || !body?.content) {
      return reply.code(400).send({ error: "title and content are required" });
    }

    const id = await ingestDocument(
      {
        title: body.title,
        author: body.author,
        chapter: body.chapter,
        page: body.page,
        year: body.year,
        type: normalizeType(body.type, "citation"),
        language: normalizeLanguage(body.language),
        source: body.source,
      },
      body.content,
    );

    return { id };
  });

  // Importa documento via upload de arquivo (PDF ou TXT).
  app.post("/api/admin/documents/upload", async (request, reply) => {
    const parts = request.parts();
    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | null = null;
    let fileName = "";
    let mimeType = "";

    for await (const part of parts) {
      if (part.type === "file") {
        fileBuffer = await part.toBuffer();
        fileName = part.filename;
        mimeType = part.mimetype;
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }

    if (!fileBuffer) {
      return reply.code(400).send({ error: "file is required" });
    }

    const text = await extractText(fileBuffer, fileName, mimeType);
    if (!text.trim()) {
      return reply.code(400).send({ error: "no extractable text in file" });
    }

    const isPdf = mimeType.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");

    const id = await ingestDocument(
      {
        title: fields.title || fileName,
        author: fields.author || undefined,
        chapter: fields.chapter || undefined,
        page: fields.page ? Number(fields.page) : undefined,
        year: fields.year ? Number(fields.year) : undefined,
        type: normalizeType(fields.type as DocumentType, isPdf ? "pdf" : "citation"),
        language: normalizeLanguage(fields.language as SupportedLanguage),
        source: fields.source || undefined,
      },
      text,
    );

    if (isPdf) {
      const filePath = await saveUpload(id, fileBuffer, fileName);
      await updateDocumentFilePath(id, filePath);
    }

    return { id };
  });
}

async function extractText(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const isPdf = mimeType.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }
  return buffer.toString("utf8");
}

function normalizeType(
  type: DocumentType | undefined,
  fallback: DocumentType,
): DocumentType {
  return type && VALID_TYPES.includes(type) ? type : fallback;
}

function normalizeLanguage(
  language: SupportedLanguage | undefined,
): SupportedLanguage {
  return language && VALID_LANGUAGES.includes(language) ? language : "pt";
}
