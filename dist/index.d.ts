import { Pool } from 'pg';

interface Document {
    id?: string;
    content: string;
    metadata?: Record<string, unknown>;
}
interface Embeddings {
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
interface VectorStore {
    /** Add or replace documents and their embeddings. embeddings[i] corresponds to documents[i] */
    add(documents: Document[], embeddings: number[][]): Promise<void>;
    /** Search by embedding and return topK documents with a score (higher is better). */
    search(queryEmbedding: number[], topK: number): Promise<Array<{
        document: Document;
        score: number;
    }>>;
    /** Delete documents by id */
    delete(ids: string[]): Promise<void>;
    /** Serialize store to JSON for dev/debug */
    serialize(): Promise<string>;
    /** Restore store from JSON produced by serialize */
    deserialize(serialized: string): Promise<void>;
}

type SimilarityMetric = 'cosine' | 'euclidean';
declare function cosineSimilarity(a: number[], b: number[]): number;
declare function euclideanDistance(a: number[], b: number[]): number;

declare class TextSplitter {
    chunkSize: number;
    chunkOverlap: number;
    constructor(chunkSize?: number, chunkOverlap?: number);
    /** Split a single text into chunked pieces (string array). */
    splitText(text: string): string[];
    /** Convenience: split into Document objects (auto id generation optional). */
    splitToDocuments(text: string, baseId?: string): Document[];
}

declare class InMemoryStore implements VectorStore {
    private store;
    constructor();
    add(documents: Document[], embeddings: number[][]): Promise<void>;
    search(queryEmbedding: number[], topK: number): Promise<Array<{
        document: Document;
        score: number;
    }>>;
    delete(ids: string[]): Promise<void>;
    serialize(): Promise<string>;
    deserialize(serialized: string): Promise<void>;
    private _generateId;
}

interface OpenAIEmbeddingsOptions {
    model?: string;
    apiKey?: string;
}
declare class OpenAIEmbeddings implements Embeddings {
    private client;
    readonly model: string;
    dimension?: number;
    constructor(options?: OpenAIEmbeddingsOptions);
    embed(input: string): Promise<number[]>;
    embedBatch(inputs: string[]): Promise<number[][]>;
}

interface PostgresStoreOptions {
    connectionString?: string;
    pool?: Pool;
    tableName?: string;
    embeddingDimension?: number;
    createTable?: boolean;
}
declare class PostgresStore implements VectorStore {
    private pool;
    private table;
    private _ready;
    constructor(opts: PostgresStoreOptions);
    add(documents: Document[], embeddings: number[][]): Promise<void>;
    search(queryEmbedding: number[], topK: number): Promise<Array<{
        document: Document;
        score: number;
    }>>;
    delete(ids: string[]): Promise<void>;
    serialize(): Promise<string>;
    deserialize(serialized: string): Promise<void>;
}

export { Document, Embeddings, InMemoryStore, OpenAIEmbeddings, PostgresStore, PostgresStoreOptions, SimilarityMetric, TextSplitter, VectorStore, cosineSimilarity, euclideanDistance };
