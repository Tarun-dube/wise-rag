import { describe, it, expect } from 'vitest';
import { TextSplitter } from '../src/splitters/TextSplitter';
import { InMemoryStore } from '../src/stores/InMemoryStore';

// Fake deterministic embeddings: map text to vector via simple hash
class FakeEmbeddings {
  dimension = 8;
  async embed(text: string): Promise<number[]> {
    return this._embedSingle(text);
  }
  async embedBatch(inputs: string[]): Promise<number[][]> {
    return inputs.map(i => this._embedSingle(i));
  }
  private _embedSingle(s: string) {
    const v = new Array(this.dimension).fill(0);
    for (let i = 0; i < s.length; i++) {
      v[i % this.dimension] += s.charCodeAt(i) % 10;
    }
    // normalize
    const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)) || 1;
    return v.map(x => x / norm);
  }
}

describe('End-to-end RAG flow (split -> embed -> store -> search)', () => {
  it('retrieves most relevant chunk for a query', async () => {
    const text = 'Alpha. Beta is here. Gamma delta epsilon. Zeta.';
    const splitter = new TextSplitter(40, 8);
    const parts = splitter.splitText(text);
    const docs = parts.map((p, i) => ({ id: `c${i}`, content: p }));

    const emb = new FakeEmbeddings();
    const vectors = await emb.embedBatch(parts);

    const store = new InMemoryStore();
    await store.add(docs, vectors);

    // pick a query similar to 'Gamma'
    const qVec = await emb.embed('Gamma');
    const res = await store.search(qVec, 1);
    expect(res.length).toBe(1);
    // best match should contain 'Gamma'
    expect(res[0].document.content.toLowerCase()).toContain('gamma');
  });
});
