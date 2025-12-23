import { Pool } from 'pg';
import { Document, VectorStore } from '../core/interfaces';

export interface PostgresStoreOptions {
  connectionString?: string;
  pool?: Pool;
  tableName?: string;
  embeddingDimension?: number; // optional, used when creating table
  createTable?: boolean; // whether to attempt to create table and extension
}

export class PostgresStore implements VectorStore {
  private pool: Pool;
  private table: string;
  private _ready: Promise<void> | null = null;
  // Note: we avoid depending on pgvector runtime helpers here and pass vectors as casted params

  constructor(opts: PostgresStoreOptions) {
    if (opts.pool) this.pool = opts.pool;
    else if (opts.connectionString) this.pool = new Pool({ connectionString: opts.connectionString });
    else throw new Error('Either pool or connectionString must be provided');

    this.table = opts.tableName ?? 'documents';
    // If requested, start initialization to create extension/table. We keep the
    // promise so public methods can wait for readiness to avoid race
    // conditions (constructors can't be async).
    if (opts.createTable) {
      const dim = opts.embeddingDimension ?? 1536;
      // capture references to avoid using `this` inside the async initializer
      const poolRef = this.pool;
      const tableRef = this.table;
      this._ready = (async () => {
        // best-effort: create extension and table; ignore errors but surface later ops' errors
        try {
          await poolRef.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
        } catch (e) {
          // ignore - extension might already exist or user lacks privileges
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
          // ignore table creation errors here; operations will surface errors when attempted
        }
      })();
    } else {
      this._ready = Promise.resolve();
    }
  }

  async add(documents: Document[], embeddings: number[][]): Promise<void> {
    // Wait for any background initialization (table creation) to complete.
    if (this._ready) await this._ready;
    if (documents.length !== embeddings.length) throw new Error('documents and embeddings length mismatch');
    if (documents.length === 0) return;

    // Build batch upsert query
    const cols = ['id', 'content', 'metadata', 'embedding'];
    const valuesSql: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (let i = 0; i < documents.length; i++) {
      const d = documents[i];
      const id = d.id ?? Math.random().toString(36).slice(2, 10);
      const content = d.content;
      const metadata = d.metadata ? d.metadata : null;
      const emb = embeddings[i];
      // pass embedding as a vector literal string and cast to vector in the query
      const embStr = '[' + emb.join(',') + ']';
      params.push(id, content, metadata, embStr);
      valuesSql.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}::vector)`);
    }

    const query = `INSERT INTO ${this.table} (${cols.join(',')}) VALUES ${valuesSql.join(',')} ` +
      `ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, metadata = EXCLUDED.metadata, embedding = EXCLUDED.embedding;`;

    await this.pool.query(query, params as any[]);
  }

  async search(queryEmbedding: number[], topK: number): Promise<Array<{ document: Document; score: number }>> {
    // Wait for initialization if applicable.
    if (this._ready) await this._ready;

    // Use pgvector cosine distance operator '<=>' and map it back to a similarity
    // score where higher is better. For identical vectors distance == 0 => score == 1.
    const embStr = '[' + queryEmbedding.join(',') + ']';
    const q = `SELECT id, content, metadata, embedding <=> $1::vector AS distance FROM ${this.table} ORDER BY embedding <=> $1::vector ASC LIMIT $2;`;
    const res = await this.pool.query(q, [embStr, topK]);
    const out: Array<{ document: Document; score: number }> = [];
    for (const row of res.rows) {
      const distance = row.distance as number;
      // Map cosine distance to similarity score. For cosine distance d
      // similarity = 1 - d. Clamp to reasonable bounds.
      let score = 1 - distance;
      if (!Number.isFinite(score)) score = 0;
      // Optional: clamp between -1 and 1, but we prefer keeping raw similarity.
      if (score > 1) score = 1;
      if (score < -1) score = -1;
      out.push({ document: { id: row.id, content: row.content, metadata: row.metadata }, score });
    }
    return out;
  }

  async delete(ids: string[]): Promise<void> {
    if (this._ready) await this._ready;
    if (ids.length === 0) return;
    await this.pool.query(`DELETE FROM ${this.table} WHERE id = ANY($1)`, [ids]);
  }

  async serialize(): Promise<string> {
    if (this._ready) await this._ready;
    const res = await this.pool.query(`SELECT id, content, metadata, embedding FROM ${this.table}`);
    // embedding will be returned as array by pgvector's custom parser
    return JSON.stringify(res.rows);
  }

  async deserialize(serialized: string): Promise<void> {
    if (this._ready) await this._ready;
  const arr: Array<{ id: string; content: string; metadata: any; embedding: number[] }> = JSON.parse(serialized);
    // simple erase and reinsert (transaction)
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`TRUNCATE TABLE ${this.table}`);
      for (const r of arr) {
        const embStr = '[' + r.embedding.join(',') + ']';
        await client.query(
          `INSERT INTO ${this.table} (id, content, metadata, embedding) VALUES ($1, $2, $3, $4::vector)`,
          [r.id, r.content, r.metadata, embStr]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

export default PostgresStore;
