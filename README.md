# Luz Interior — Plataforma de IA (Baba Ideology)

Plataforma de conversação com IA baseada em RAG (Retrieval-Augmented Generation),
alimentada exclusivamente por conteúdo cadastrado manualmente (livros, PDFs,
documentos, textos e palestras transcritas). A IA responde de forma fiel ao
material fornecido, cita as fontes e nunca busca informação na internet.

## Principais características

- **Bibliotecária inteligente**: respostas objetivas e curtas, com sugestão de leitura apontando ao texto original da mestre — a IA facilita o acesso, não substitui a leitura.
- Respostas baseadas apenas no conteúdo indexado, com citação de fontes.
- Busca híbrida: similaridade vetorial (pgvector) + full-text (PostgreSQL).
- Cache inteligente por similaridade de embedding, reduzindo chamadas ao LLM.
- Providers de IA intercambiáveis (OpenAI, Gemini, Claude) via variável de ambiente.
- Rate limiting por IP configurável.
- Sessões anônimas com histórico de conversas (retenção de 30 dias).
- Interface trilíngue (PT/EN/ES); a IA responde no idioma da pergunta.
- Painel administrativo protegido por senha para gerir a base de conhecimento.
- Design solar (laranja/amarelo), leve e intuitivo.

## Arquitetura

```
Usuário → Frontend (React/Vite) → Backend (Fastify)
                                     ├─ Rate limit por IP
                                     ├─ Embedding da pergunta
                                     ├─ Cache inteligente (similaridade)
                                     ├─ Busca híbrida (pgvector + full-text)
                                     ├─ Seleção de 5–10 trechos relevantes
                                     ├─ Prompt rígido + trechos → LLM (stream)
                                     └─ Citação de fontes
```

Nunca são enviados livros inteiros ao modelo, apenas os trechos relevantes.

## Estrutura do monorepo

```
baba_ideology/
├── apps/
│   ├── api/         # Backend Fastify + RAG + providers
│   └── web/         # Frontend React + Vite + Tailwind
├── packages/
│   └── shared/      # Tipos TypeScript compartilhados
├── docker-compose.yml
├── .env.example
└── README.md
```

O backend segue separação por responsabilidade: `providers/` (LLM e embeddings),
`rag/` (chunking, retrieval, cache, prompt), `vector/` (pgvector), `database/`
(schema, migrations, repositórios), `prompts/`, `services/`, `routes/`, `jobs/`.

## Pré-requisitos

- Node.js 20+ e pnpm 9+ (`corepack enable && corepack prepare pnpm@9 --activate`).
- Docker e Docker Compose (banco local).
- Chave de API de pelo menos um provider (OpenAI recomendado para embeddings).

## Configuração

1. Instale as dependências:

```bash
pnpm install
```

2. Suba o PostgreSQL local com pgvector:

```bash
pnpm db:up
```

Isso sobe um container Docker na porta `5432` com usuário `postgres`, senha
`postgres` e banco `baba`. Se a porta já estiver em uso, pare o outro serviço
ou altere o mapeamento em `docker-compose.yml`.

3. Crie o arquivo de ambiente do backend a partir do exemplo:

```bash
cp .env.example apps/api/.env
```

4. Preencha em `apps/api/.env` pelo menos:
   - `DATABASE_URL` (local: `postgresql://postgres:postgres@localhost:5432/baba`)
   - `OPENAI_API_KEY` (para embeddings; e para o LLM se `LLM_PROVIDER=openai`)
   - `ADMIN_PASSWORD` (senha do painel administrativo)

5. Rode as migrations (cria tabelas, índices e extensões):

```bash
pnpm migrate
```

## Executar em desenvolvimento

```bash
pnpm dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3333 (o Vite faz proxy de `/api` para o backend)

## Alimentar a base de conhecimento

1. Acesse http://localhost:5173/admin e entre com a `ADMIN_PASSWORD`.
2. Importe documentos por upload de PDF/TXT ou colando texto diretamente.
3. Preencha os metadados (título, autor, capítulo, página, ano, tipo, idioma, fonte).
4. O documento é dividido em chunks, indexado com embeddings e fica disponível.
5. Ações disponíveis: ver trechos, reprocessar embeddings, remover documento e
   reconstruir o índice vetorial.

## Variáveis de ambiente

Consulte `.env.example` para a lista completa. Principais grupos:

- Servidor: `PORT`, `NODE_ENV`, `CORS_ORIGIN`.
- Banco: `DATABASE_URL` (local via Docker; em produção, injetada pelo Railway).
- Providers: `LLM_PROVIDER` (`openai|gemini|claude`), `EMBEDDING_PROVIDER`,
  `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` e os modelos.
- RAG: `CHUNK_SIZE`, `CHUNK_OVERLAP`, `RETRIEVAL_MIN_CHUNKS`,
  `RETRIEVAL_MAX_CHUNKS`, `HYBRID_VECTOR_WEIGHT`, `HYBRID_TEXT_WEIGHT`,
  `RERANK_ENABLED`.
- Cache: `CACHE_ENABLED`, `CACHE_SIMILARITY_THRESHOLD`.
- Rate limit: `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`.
- Retenção: `CONVERSATION_RETENTION_DAYS`.
- Admin: `ADMIN_PASSWORD`.

## Retenção de dados (30 dias)

Conversas, mensagens, sessões e cache com mais de `CONVERSATION_RETENTION_DAYS`
dias são apagados. A limpeza roda automaticamente uma vez por dia dentro do
próprio processo do backend. Também pode ser executada manualmente:

```bash
pnpm --filter api cleanup
```

Feedback e a base de conhecimento não são afetados pela retenção.

## Deploy

### Backend (Railway)

- O arquivo `apps/api/railway.json` define build e start.
- Crie um serviço **PostgreSQL** separado no Railway (com suporte a pgvector).
- No serviço da API, referencie a variável `DATABASE_URL` do banco
  (ex.: `${{Postgres.DATABASE_URL}}` no painel do Railway).
- Configure as demais variáveis de ambiente no painel do Railway.
- Rode `pnpm migrate` uma vez após o primeiro deploy.
- Opcional: crie um serviço Cron no Railway com o comando
  `pnpm --filter api cleanup` (a limpeza também já roda no processo principal).

### Frontend (Vercel)

- O arquivo `apps/web/vercel.json` define build e rewrites (SPA).
- Defina o Root Directory do projeto como `apps/web`.
- Configure `VITE_API_URL` com a URL pública do backend no Railway.

## Estimativa de custo

Vercel (free) + Railway API + PostgreSQL (~$5–10/mês) + APIs de IA (~$1–3/mês) =
aproximadamente $6–13/mês. O cache inteligente reduz ainda mais o custo com o LLM.

## Scripts úteis

- `pnpm db:up` — sobe o PostgreSQL local (Docker).
- `pnpm db:down` — para o PostgreSQL local.
- `pnpm db:reset` — recria o banco local do zero (apaga os dados).
- `pnpm dev` — sobe frontend e backend.
- `pnpm build` — build de shared, api e web.
- `pnpm migrate` — aplica as migrations.
- `pnpm --filter api cleanup` — executa a limpeza de retenção.
