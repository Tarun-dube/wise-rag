import { Document, VectorStore, SearchOptions } from '../core/interfaces';
import { cosineSimilarity, euclideanDistance } from '../core/types';

type Entry = { id: string; embedding: number[]; doc: Document };

export class InMemoryStore implements VectorStore {
  private store = new Map<string, Entry>();

  constructor() {}

  async add(documents: Document[], embeddings: number[][]): Promise<void> {
    if (documents.length !== embeddings.length) throw new Error('documents and embeddings length mismatch');
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const emb = embeddings[i];
      const id = doc.id ?? this._generateId();
      this.store.set(id, { id, embedding: emb, doc: { ...doc, id } });
    }
  }

  async search(
    queryEmbedding: number[],
    topK: number,
    options: SearchOptions = {}
  ): Promise<Array<{ document: Document; score: number }>> {
    const { filter, metric = 'cosine' } = options;
    const results: Array<{ document: Document; score: number }> = [];
    for (const e of this.store.values()) {
      // metadata filtering (shallow equality for provided keys)
      if (filter && Object.keys(filter).length > 0) {
        const md = e.doc.metadata ?? {};
        let ok = true;
        for (const k of Object.keys(filter)) {
          // if metadata missing or mismatched, skip
          // treat undefined !== null etc. as mismatch
          if (!(k in md) || (md as Record<string, unknown>)[k] !== filter[k]) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
      }

      try {
        let score = 0;
        if (metric === 'cosine') {
          score = cosineSimilarity(queryEmbedding, e.embedding);
        } else if (metric === 'euclidean') {
          // convert distance to score (higher is better)
          const dist = euclideanDistance(queryEmbedding, e.embedding);
          score = 1 / (1 + dist);
        } else {
          // unknown metric - skip
          continue;
        }
        results.push({ document: e.doc, score });
      } catch (err) {
        // skip size-mismatch entries
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) this.store.delete(id);
  }

  async serialize(): Promise<string> {
    const arr = Array.from(this.store.values()).map(e => ({ id: e.id, embedding: e.embedding, doc: e.doc }));
    return JSON.stringify(arr);
  }

  async deserialize(serialized: string): Promise<void> {
    const arr: Array<{ id: string; embedding: number[]; doc: Document }> = JSON.parse(serialized);
    this.store.clear();
    for (const e of arr) this.store.set(e.id, { id: e.id, embedding: e.embedding, doc: e.doc });
  }

  private _generateId(): string {
    return Math.random().toString(36).slice(2, 10);
  }
}

export default InMemoryStore;
