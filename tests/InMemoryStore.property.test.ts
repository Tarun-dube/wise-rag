import { describe, it, expect } from 'vitest';
import { InMemoryStore } from '../src/stores/InMemoryStore';

function bruteTopK(embs: number[][], query: number[], k: number) {
  const scores = ems(embs, query).map((s, i) => ({ i, score: s }));
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, k).map(s => s.i);
}

function ems(embs: number[][], query: number[]) {
  return emsCompute(embs, query);
}

function emsCompute(embs: number[][], query: number[]) {
  return embs.map(e => {
    if (e.length !== query.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < e.length; i++) {
      dot += e[i] * query[i];
      na += e[i] * e[i];
      nb += query[i] * query[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  });
}

describe('InMemoryStore property tests', () => {
  it('matches brute-force top-k for random vectors', async () => {
    const n = 40, dim = 12;
    const docs = Array.from({ length: n }, (_, i) => ({ id: String(i), content: `doc-${i}` }));
    const embs = docs.map(() => Array.from({ length: dim }, () => Math.random() * 2 - 1));
    const s = new InMemoryStore();
    await s.add(docs, embs);
    for (let t = 0; t < 8; t++) {
      const q = Array.from({ length: dim }, () => Math.random() * 2 - 1);
  const res = await s.search(q, 3);
  const expected = bruteTopK(embs, q, 3);
  // compare numeric ids
  expect(res.map(r => Number(r.document.id))).toEqual(expected);
    }
  }, 20_000);

  it('handles empty store and empty queries gracefully', async () => {
    const s = new InMemoryStore();
    const res = await s.search([1, 0, 0], 5);
    expect(res).toEqual([]);
  });
});
