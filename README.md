# my-rag-lib

Minimal RAG helper library with:

- Text splitter
- In-memory vector store (dev)
- OpenAI Embeddings wrapper (official OpenAI Node SDK)

Usage:

1. Install dependencies and build:

```bash
cd my-rag-lib
npm install
npm run build
```

2. Example:

```ts
import { TextSplitter, InMemoryStore, OpenAIEmbeddings } from 'my-rag-lib';

const splitter = new TextSplitter(800, 200);
const parts = splitter.splitToDocuments('Long text...');

const emb = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
const vectors = await emb.embedBatch(parts.map(p => p.content));

const store = new InMemoryStore();
await store.add(parts, vectors);

const q = await emb.embed('query');
const results = await store.search(q, 3);
```
