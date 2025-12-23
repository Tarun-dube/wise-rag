import { describe, it, expect, beforeEach } from 'vitest';
import { PostgresStore } from '../src/stores/PostgresStore';

// Minimal in-test fake Pool that simulates the small subset of behaviour
// used by PostgresStore (query, connect/release). This avoids needing a
// real Postgres instance for unit tests.
class FakePool {
  rows: Map<string, { id: string; content: string; metadata: any; embedding: number[] }> = new Map();

  async query(sql: string, params?: any[]) {
    const s = sql.trim();
    // simple handlers for queries PostgresStore issues
    if (s.startsWith('INSERT INTO')) {
      // params are groups of [id, content, metadata, embStr]
      if (!params) return { rowCount: 0 };
      for (let i = 0; i < params.length; i += 4) {
        const id = params[i];
        const content = params[i + 1];
        const metadata = params[i + 2];
        const embStr = params[i + 3];
        const embedding = parseEmbStr(embStr);
        this.rows.set(id, { id, content, metadata, embedding });
      }
      return { rowCount: params.length / 4 };
    }

    if (s.includes('<=>') && s.startsWith('SELECT')) {
      // search: params [embStr, topK]
      const embStr = params ? params[0] : '[]';
      const topK = params ? params[1] : 10;
      const qEmb = parseEmbStr(embStr);
      const arr = Array.from(this.rows.values()).map(r => {
        const distance = 1 - cosineSimilarity(qEmb, r.embedding); // emulate pgvector cosine distance
        return { id: r.id, content: r.content, metadata: r.metadata, distance };
      });
      arr.sort((a, b) => a.distance - b.distance);
      const rows = arr.slice(0, topK).map(x => ({ id: x.id, content: x.content, metadata: x.metadata, distance: x.distance }));
      return { rows };
    }

    if (s.startsWith('DELETE FROM')) {
      const ids: string[] = params ? params[0] : [];
      for (const id of ids) this.rows.delete(id);
      return { rowCount: ids.length };
    }

    if (s.startsWith('SELECT id, content, metadata, embedding FROM')) {
      const rows = Array.from(this.rows.values()).map(r => ({ id: r.id, content: r.content, metadata: r.metadata, embedding: r.embedding }));
      return { rows };
    }

    if (s.startsWith('TRUNCATE TABLE')) {
      this.rows.clear();
      return { rowCount: 0 };
    }

    // BEGIN, COMMIT, ROLLBACK and other control statements
    if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
      return { rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  }

  async connect() {
    const pool = this;
    return {
      query: async (sql: string, params?: any[]) => {
        return await pool.query(sql, params);
      },
      release: () => {},
    };
  }
}

function parseEmbStr(s: string): number[] {
  if (Array.isArray(s)) return s as number[];
  // s may be like '[1,2,3]'
  if (typeof s === 'string') {
    return s.replace(/^[\[]|[\]]$/g, '').split(',').filter(Boolean).map(x => Number(x));
  }
  return [];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

describe('PostgresStore (fake pool)', () => {
  let pool: FakePool;
  let store: PostgresStore;

  beforeEach(() => {
  pool = new FakePool();
  // cast to any to avoid requiring the full pg.Pool shape in this unit test
  store = new PostgresStore({ pool: pool as any });
  });

  it('adds and searches documents', async () => {
    const docs = [{ id: 'a', content: 'A' }, { id: 'b', content: 'B' }];
    const embeddings = [[1, 0], [0, 1]];
    await store.add(docs, embeddings);

    const res = await store.search([1, 0], 2);
    expect(res.length).toBe(2);
    expect(res[0].document.id).toBe('a');
    // score should roughly equal cosine similarity
    expect(res[0].score).toBeGreaterThan(0.9);
  });

  it('delete removes rows', async () => {
    const docs = [{ id: 'x', content: 'X' }, { id: 'y', content: 'Y' }];
    const embeddings = [[1, 0], [1, 0]];
    await store.add(docs, embeddings);
    await store.delete(['x']);
    const res = await store.search([1, 0], 10);
    expect(res.some(r => r.document.id === 'x')).toBe(false);
    expect(res.some(r => r.document.id === 'y')).toBe(true);
  });

  it('serialize / deserialize roundtrip', async () => {
    const docs = [{ id: 'm', content: 'M', metadata: { t: 1 } }];
    const embeddings = [[2, 0, 0]];
    await store.add(docs, embeddings);
    const serialized = await store.serialize();
    // create a fresh store and deserialize into it
  const pool2 = new FakePool();
  const store2 = new PostgresStore({ pool: pool2 as any });
    await store2.deserialize(serialized);
    const res = await store2.search([1, 0, 0], 1);
    expect(res.length).toBe(1);
    expect(res[0].document.id).toBe('m');
    expect(res[0].document.metadata).toEqual({ t: 1 });
  });
});
