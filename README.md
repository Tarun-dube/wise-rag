# wise-rag

Minimal RAG helper library with:

- Text splitter (chunking & overlap)
- Embeddings wrapper for OpenAI (`OpenAIEmbeddings`)
- In-memory vector store for development and testing (`InMemoryStore`)
- Postgres-backed vector store using `pg` + `pgvector` (`PostgresStore`)
- Migrations and SQL for pgvector (see `migrations/`)
- Test suite and examples (unit, property, and integration-style tests)
- CI workflow for build/test and (optional) publish

Install (consumer)

```bash
npm install wise-rag
```

Quick example (TypeScript)

```ts
import { TextSplitter, InMemoryStore, OpenAIEmbeddings } from 'wise-rag';

async function example() {
	const text = 'Long document text...';

	const splitter = new TextSplitter(800, 200);
	const parts = splitter.splitToDocuments(text, 'doc1');

	const emb = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
	const vectors = await emb.embedBatch(parts.map(p => p.content));

	const store = new InMemoryStore();
	await store.add(parts, vectors);

	const q = await emb.embed('query');
	const results = await store.search(q, 3);
	console.log(results);
}

example().catch(console.error);
```

Developer (working on the repo)

```bash
# from the project root (this repo)
npm install
npm run build
npm test
```

## PostgresStore (Postgres + pgvector)

If you want a production-ready store backed by Postgres and pgvector, `PostgresStore` is provided. A few notes for consumers:

- Install a Postgres client: `npm install pg` (the package expects `pg` as a peer dependency).
- Ensure your Postgres instance has the `pgvector` extension installed and available in the database.

Minimal usage example:

```ts
import { TextSplitter, PostgresStore, OpenAIEmbeddings } from 'wise-rag';
import { Pool } from 'pg';

const splitter = new TextSplitter(800, 200);
const parts = splitter.splitToDocuments('Long document text', 'doc1');

// create embeddings (OpenAI key required)
const emb = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
const vectors = await emb.embedBatch(parts.map(p => p.content));

// create a pg Pool (consumer must install `pg`)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// PostgresStore constructor options: connectionString | pool, tableName, embeddingDimension, createTable
const store = new PostgresStore({ pool, tableName: 'documents', embeddingDimension: emb.dimension ?? 1536, createTable: true });
await store.add(parts, vectors);

// query
const q = await emb.embed('query');
console.log(await store.search(q, 3));
```

Create the `pgvector` extension and documents table (if you prefer to run migration manually):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS documents (
	id TEXT PRIMARY KEY,
	content TEXT,
	metadata JSONB,
	embedding vector(1536)
);
```

Notes

- `PostgresStore` will attempt to run `CREATE EXTENSION IF NOT EXISTS vector;` when `createTable: true` is passed, but this requires the Postgres role to have permission to create extensions.
- If you publish a private package or run CI that interacts with Postgres, make sure database credentials and tokens are stored securely in secrets and rotated regularly.
