## Quick start

This package is published on npm as `wise-rag`. It provides a minimal RAG helper library with:

- A text splitter (`TextSplitter`)
- An embeddings wrapper for OpenAI (`OpenAIEmbeddings`)
- An in-memory vector store for development (`InMemoryStore`)
- A Postgres-backed store using `pgvector` (`PostgresStore`)

Prerequisites

- Node 18+ / npm
- If you use `OpenAIEmbeddings`, you need an OpenAI API key (set `OPENAI_API_KEY` or pass via options)
- If you use `PostgresStore`, install `pg` and ensure your Postgres has the `pgvector` extension (see notes below)

Install (consumer)

```bash
npm install wise-rag
```

Quick example (TypeScript)

```ts
import { TextSplitter, InMemoryStore, OpenAIEmbeddings } from 'wise-rag';

async function main() {
  const text = `Long document text ...`;

  // 1) Split text into chunks
  const splitter = new TextSplitter(800, 200);
  const docs = splitter.splitToDocuments(text, 'doc1');

  // 2) Create embeddings (requires OpenAI API key)
  const emb = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
  const vectors = await emb.embedBatch(docs.map(d => d.content));

  // 3) Store into in-memory store
  const store = new InMemoryStore();
  await store.add(docs, vectors);

  // 4) Query
  const qVec = await emb.embed('What is the summary?');
  const results = await store.search(qVec, 3);
  console.log(results);
}

main().catch(console.error);
```

JavaScript (ESM) example

```js
import { TextSplitter, InMemoryStore, OpenAIEmbeddings } from 'wise-rag';

const splitter = new TextSplitter(800, 200);
const docs = splitter.splitToDocuments('Long document text', 'doc1');
const emb = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
const vectors = await emb.embedBatch(docs.map(d => d.content));
const store = new InMemoryStore();
await store.add(docs, vectors);
const qVec = await emb.embed('summary?');
console.log(await store.search(qVec, 3));
```

Developer notes (if you're working on the repo)

Install dependencies and build locally:

```bash
cd my-rag-lib
npm install
npm run build
```

Run tests:

```bash
npm test
```

API reference (short)

- Document

```ts
interface Document {
  id?: string;
  content: string;
  metadata?: Record<string, unknown>;
}
```

- Embeddings

```ts
interface Embeddings {
  embed(input: string): Promise<number[]>;
  embedBatch(inputs: string[]): Promise<number[][]>;
  readonly dimension?: number;
}
```

- VectorStore

```ts
interface VectorStore {
  add(documents: Document[], embeddings: number[][]): Promise<void>;
  search(queryEmbedding: number[], topK: number): Promise<Array<{ document: Document; score: number }>>;
  delete(ids: string[]): Promise<void>;
  serialize(): Promise<string>;
  deserialize(serialized: string): Promise<void>;
}
```

Provided implementations

- `TextSplitter(chunkSize?: number = 1000, chunkOverlap?: number = 200)`
  - Methods: `splitText(text: string): string[]`, `splitToDocuments(text: string, baseId?: string): Document[]`
  - Behavior: naive sentence splitting, sliding-window style overlap.

- `OpenAIEmbeddings` (wrapper around official `openai` SDK)
  - Constructor opts: `{ model?: string, apiKey?: string }`
  - Throws if no API key provided via options or `OPENAI_API_KEY` env var.

- `InMemoryStore` (development store)
  - Simple add/search/delete/serialize/deserialize implementation using cosine similarity.

- `PostgresStore` (production-ready store using `pg` + `pgvector`)
  - Constructor opts: `{ connectionString?: string, pool?: Pool, tableName?: string, embeddingDimension?: number, createTable?: boolean }`
  - Notes: `createTable` will attempt to create the `vector` extension and a table with an `embedding vector(dim)` column. The store sends embeddings as `[...]::vector` literals.

Postgres + pgvector notes

- The library expects `pgvector` extension in your DB. If `createTable` is true when constructing `PostgresStore`, it will run `CREATE EXTENSION IF NOT EXISTS vector;` and create a default `documents` table. You can also run the migration in `migrations/001_create_documents_pgvector.sql` manually.

- Example minimal setup (psql):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  content TEXT,
  metadata JSONB,
  embedding vector(1536)
);
```

Publishing & repository

- This package is published on npm as `wise-rag` and the source is available at https://github.com/Tarun-dube/wise-rag

Contributing

If you add features or change public APIs, please update this document and add examples under `tests/` or an `examples/` directory.

License: MIT

