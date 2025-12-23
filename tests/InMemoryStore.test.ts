import { describe, it, expect } from 'vitest';
import { InMemoryStore } from '../src/stores/InMemoryStore';

describe('InMemoryStore', () => {
  it('adds and searches documents by cosine similarity', async () => {
    const s = new InMemoryStore();
    const docs = [{ id: 'a', content: 'A' }, { id: 'b', content: 'B' }];
    const embeddings = [[1, 0], [0, 1]];
    await s.add(docs, embeddings);
    const res = await s.search([1, 0], 1);
    expect(res.length).toBe(1);
    expect(res[0].document.id).toBe('a');
    expect(res[0].score).toBeGreaterThan(0.9);
  });

  it('supports metadata filtering', async () => {
    const s = new InMemoryStore();
    const docs = [
      { id: 'a', content: 'A', metadata: { tag: 'keep' } },
      { id: 'b', content: 'B', metadata: { tag: 'skip' } }
    ];
    const embeddings = [[1, 0], [1, 0]];
    await s.add(docs, embeddings);
    const res = await s.search([1, 0], 10, { filter: { tag: 'keep' } });
    expect(res.length).toBe(1);
    expect(res[0].document.id).toBe('a');
  });

  it('supports euclidean metric (converted to score)', async () => {
    const s = new InMemoryStore();
    const docs = [
      { id: 'a', content: 'A' },
      { id: 'b', content: 'B' }
    ];
    const embeddings = [[0, 0], [10, 0]];
    await s.add(docs, embeddings);
    const res = await s.search([1, 0], 2, { metric: 'euclidean' });
    expect(res.length).toBe(2);
    // closer point should be first (a at distance 1 vs b at distance 9)
    expect(res[0].document.id).toBe('a');
  });
});
