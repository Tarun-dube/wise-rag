export interface Document {
  id?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface Embeddings {
  /**
   * Embed a single input string and return the float vector.
   */
  embed(input: string): Promise<number[]>;

  /**
   * Embed a batch of strings and return an array of vectors matching order.
   */
  embedBatch(inputs: string[]): Promise<number[][]>;

  /** Optional known embedding dimension (may be undefined until first call) */
  readonly dimension?: number;
}

import { SimilarityMetric } from './types';

export interface SearchOptions {
  /** Optional key-value metadata filter. All provided keys must equal the stored metadata values. */
  filter?: Record<string, unknown>;
  /** Similarity metric to use for ranking (default: 'cosine'). */
  metric?: SimilarityMetric;
}

export interface VectorStore {
  /** Add or replace documents and their embeddings. embeddings[i] corresponds to documents[i] */
  add(documents: Document[], embeddings: number[][]): Promise<void>;

  /**
   * Search by embedding and return topK documents with a score (higher is better).
   * The optional `options` may include a metadata filter and a similarity metric.
   */
  search(
    queryEmbedding: number[],
    topK: number,
    options?: SearchOptions
  ): Promise<Array<{ document: Document; score: number }> >;

  /** Delete documents by id */
  delete(ids: string[]): Promise<void>;

  /** Serialize store to JSON for dev/debug */
  serialize(): Promise<string>;

  /** Restore store from JSON produced by serialize */
  deserialize(serialized: string): Promise<void>;
}
