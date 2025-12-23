import OpenAI from 'openai';
import { Embeddings } from '../core/interfaces';

export interface OpenAIEmbeddingsOptions {
  model?: string;
  apiKey?: string; // optional: falls back to process.env.OPENAI_API_KEY
}

export class OpenAIEmbeddings implements Embeddings {
  private client: OpenAI;
  readonly model: string;
  dimension?: number;

  constructor(options: OpenAIEmbeddingsOptions = {}) {
    this.model = options.model ?? 'text-embedding-3-small';
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key is required; pass via options or set OPENAI_API_KEY');
    this.client = new OpenAI({ apiKey });
  }

  async embed(input: string): Promise<number[]> {
    const res = await this.client.embeddings.create({ model: this.model, input });
    const embedding = res.data[0].embedding as number[];
    this.dimension = embedding.length;
    return embedding;
  }

  async embedBatch(inputs: string[]): Promise<number[][]> {
    const res = await this.client.embeddings.create({ model: this.model, input: inputs });
    const embeddings = res.data.map((d: any) => d.embedding as number[]);
    if (embeddings.length > 0) this.dimension = embeddings[0].length;
    return embeddings;
  }
}

export default OpenAIEmbeddings;
