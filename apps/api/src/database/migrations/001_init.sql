-- ============================================================
-- Baba Ideology - Schema inicial (PostgreSQL + pgvector)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- Base de conhecimento ----------

CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  author      TEXT,
  chapter     TEXT,
  page        INTEGER,
  year        INTEGER,
  type        TEXT NOT NULL DEFAULT 'document'
              CHECK (type IN ('book','pdf','document','text','transcript')),
  language    TEXT NOT NULL DEFAULT 'pt',
  source      TEXT,
  file_path   TEXT,
  status      TEXT NOT NULL DEFAULT 'processing'
              CHECK (status IN ('processing','indexed','error')),
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  embedding    VECTOR(1536),
  chapter      TEXT,
  page         INTEGER,
  chunk_index  INTEGER NOT NULL DEFAULT 0,
  content_tsv  TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS document_chunks_tsv_idx
  ON document_chunks USING gin (content_tsv);
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx
  ON document_chunks (document_id);

-- ---------- Conversas (sessao anonima) ----------

CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_session_id_idx
  ON conversations (session_id);

CREATE TABLE IF NOT EXISTS messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content          TEXT NOT NULL,
  sources          JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx
  ON messages (conversation_id);

-- ---------- Cache inteligente ----------

CREATE TABLE IF NOT EXISTS response_cache (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question           TEXT NOT NULL,
  question_embedding VECTOR(1536),
  answer             TEXT NOT NULL,
  sources            JSONB,
  language           TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS response_cache_embedding_idx
  ON response_cache USING ivfflat (question_embedding vector_cosine_ops) WITH (lists = 100);

-- ---------- Feedback (sem dados pessoais) ----------

CREATE TABLE IF NOT EXISTS feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT NOT NULL,
  rating      SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Rate limiting por IP ----------

CREATE TABLE IF NOT EXISTS rate_limits (
  ip            TEXT PRIMARY KEY,
  count         INTEGER NOT NULL DEFAULT 0,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
