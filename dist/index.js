// src/core/types.ts
function cosineSimilarity(a, b) {
  if (a.length !== b.length)
    throw new Error("Vectors must be same length");
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0)
    return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
function euclideanDistance(a, b) {
  if (a.length !== b.length)
    throw new Error("Vectors must be same length");
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

// src/splitters/TextSplitter.ts
var TextSplitter = class {
  constructor(chunkSize = 1e3, chunkOverlap = 200) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    if (chunkOverlap >= chunkSize)
      throw new Error("chunkOverlap must be smaller than chunkSize");
  }
  /** Split a single text into chunked pieces (string array). */
  splitText(text) {
    const sentences = text.replace(/\r\n/g, "\n").split(/(?<=[.?!])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
    const chunks = [];
    let current = "";
    for (const sent of sentences) {
      if (current.length + sent.length + 1 <= this.chunkSize) {
        current = current ? `${current} ${sent}` : sent;
      } else {
        if (current)
          chunks.push(current);
        if (sent.length > this.chunkSize) {
          for (let i = 0; i < sent.length; i += this.chunkSize - this.chunkOverlap) {
            chunks.push(sent.slice(i, i + this.chunkSize));
          }
          current = "";
        } else {
          current = sent;
        }
      }
    }
    if (current)
      chunks.push(current);
    if (this.chunkOverlap > 0) {
      const overlapped = [];
      for (let i = 0; i < chunks.length; i++) {
        const base = chunks[i];
        let composed = base;
        if (i > 0) {
          const prev = chunks[i - 1];
          const keep = Math.min(this.chunkOverlap, prev.length);
          composed = prev.slice(prev.length - keep) + " " + base;
        }
        overlapped.push(composed);
      }
      return overlapped;
    }
    return chunks;
  }
  /** Convenience: split into Document objects (auto id generation optional). */
  splitToDocuments(text, baseId) {
    const parts = this.splitText(text);
    return parts.map((p, i) => ({ id: baseId ? `${baseId}::${i}` : void 0, content: p }));
  }
};

// src/stores/InMemoryStore.ts
var InMemoryStore = class {
  constructor() {
    this.store = /* @__PURE__ */ new Map();
  }
  async add(documents, embeddings) {
    if (documents.length !== embeddings.length)
      throw new Error("documents and embeddings length mismatch");
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const emb = embeddings[i];
      const id = doc.id ?? this._generateId();
      this.store.set(id, { id, embedding: emb, doc: { ...doc, id } });
    }
  }
  async search(queryEmbedding, topK) {
    const results = [];
    for (const e of this.store.values()) {
      try {
        const score = cosineSimilarity(queryEmbedding, e.embedding);
        results.push({ document: e.doc, score });
      } catch (err) {
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
  async delete(ids) {
    for (const id of ids)
      this.store.delete(id);
  }
  async serialize() {
    const arr = Array.from(this.store.values()).map((e) => ({ id: e.id, embedding: e.embedding, doc: e.doc }));
    return JSON.stringify(arr);
  }
  async deserialize(serialized) {
    const arr = JSON.parse(serialized);
    this.store.clear();
    for (const e of arr)
      this.store.set(e.id, { id: e.id, embedding: e.embedding, doc: e.doc });
  }
  _generateId() {
    return Math.random().toString(36).slice(2, 10);
  }
};

// src/embeddings/OpenAIEmbeddings.ts
import OpenAI from "openai";
var OpenAIEmbeddings = class {
  constructor(options = {}) {
    this.model = options.model ?? "text-embedding-3-small";
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey)
      throw new Error("OpenAI API key is required; pass via options or set OPENAI_API_KEY");
    this.client = new OpenAI({ apiKey });
  }
  async embed(input) {
    const res = await this.client.embeddings.create({ model: this.model, input });
    const embedding = res.data[0].embedding;
    this.dimension = embedding.length;
    return embedding;
  }
  async embedBatch(inputs) {
    const res = await this.client.embeddings.create({ model: this.model, input: inputs });
    const embeddings = res.data.map((d) => d.embedding);
    if (embeddings.length > 0)
      this.dimension = embeddings[0].length;
    return embeddings;
  }
};

// src/stores/PostgresStore.ts
import { Pool } from "pg";
var PostgresStore = class {
  // Note: we avoid depending on pgvector runtime helpers here and pass vectors as casted params
  constructor(opts) {
    this._ready = null;
    if (opts.pool)
      this.pool = opts.pool;
    else if (opts.connectionString)
      this.pool = new Pool({ connectionString: opts.connectionString });
    else
      throw new Error("Either pool or connectionString must be provided");
    this.table = opts.tableName ?? "documents";
    if (opts.createTable) {
      const dim = opts.embeddingDimension ?? 1536;
      const poolRef = this.pool;
      const tableRef = this.table;
      this._ready = (async () => {
        try {
          await poolRef.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
        } catch (e) {
        }
        try {
          await poolRef.query(
            `CREATE TABLE IF NOT EXISTS ${tableRef} (
              id TEXT PRIMARY KEY,
              content TEXT,
              metadata JSONB,
              embedding vector(${dim})
            );`
          );
        } catch (e) {
        }
      })();
    } else {
      this._ready = Promise.resolve();
    }
  }
  async add(documents, embeddings) {
    if (this._ready)
      await this._ready;
    if (documents.length !== embeddings.length)
      throw new Error("documents and embeddings length mismatch");
    if (documents.length === 0)
      return;
    const cols = ["id", "content", "metadata", "embedding"];
    const valuesSql = [];
    const params = [];
    let pIdx = 1;
    for (let i = 0; i < documents.length; i++) {
      const d = documents[i];
      const id = d.id ?? Math.random().toString(36).slice(2, 10);
      const content = d.content;
      const metadata = d.metadata ? d.metadata : null;
      const emb = embeddings[i];
      const embStr = "[" + emb.join(",") + "]";
      params.push(id, content, metadata, embStr);
      valuesSql.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}::vector)`);
    }
    const query = `INSERT INTO ${this.table} (${cols.join(",")}) VALUES ${valuesSql.join(",")} ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, metadata = EXCLUDED.metadata, embedding = EXCLUDED.embedding;`;
    await this.pool.query(query, params);
  }
  async search(queryEmbedding, topK) {
    if (this._ready)
      await this._ready;
    const embStr = "[" + queryEmbedding.join(",") + "]";
    const q = `SELECT id, content, metadata, embedding <=> $1::vector AS distance FROM ${this.table} ORDER BY embedding <=> $1::vector ASC LIMIT $2;`;
    const res = await this.pool.query(q, [embStr, topK]);
    const out = [];
    for (const row of res.rows) {
      const distance = row.distance;
      let score = 1 - distance;
      if (!Number.isFinite(score))
        score = 0;
      if (score > 1)
        score = 1;
      if (score < -1)
        score = -1;
      out.push({ document: { id: row.id, content: row.content, metadata: row.metadata }, score });
    }
    return out;
  }
  async delete(ids) {
    if (this._ready)
      await this._ready;
    if (ids.length === 0)
      return;
    await this.pool.query(`DELETE FROM ${this.table} WHERE id = ANY($1)`, [ids]);
  }
  async serialize() {
    if (this._ready)
      await this._ready;
    const res = await this.pool.query(`SELECT id, content, metadata, embedding FROM ${this.table}`);
    return JSON.stringify(res.rows);
  }
  async deserialize(serialized) {
    if (this._ready)
      await this._ready;
    const arr = JSON.parse(serialized);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`TRUNCATE TABLE ${this.table}`);
      for (const r of arr) {
        const embStr = "[" + r.embedding.join(",") + "]";
        await client.query(
          `INSERT INTO ${this.table} (id, content, metadata, embedding) VALUES ($1, $2, $3, $4::vector)`,
          [r.id, r.content, r.metadata, embStr]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
};
export {
  InMemoryStore,
  OpenAIEmbeddings,
  PostgresStore,
  TextSplitter,
  cosineSimilarity,
  euclideanDistance
};
//# sourceMappingURL=index.js.map