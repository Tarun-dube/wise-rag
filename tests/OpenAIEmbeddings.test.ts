import { describe, it, expect, vi } from 'vitest';
import OpenAI from 'openai';
import { OpenAIEmbeddings } from '../src/embeddings/OpenAIEmbeddings';

// Mock the OpenAI client to avoid network calls and to assert parameters are forwarded
vi.mock('openai', () => {
  return {
    default: class MockClient {
      embeddings = {
        create: async ({ model, input }: any) => {
          // return deterministic embeddings based on input length
          const arr = Array.isArray(input) ? input : [input];
          return { data: arr.map((x: any, idx: number) => ({ embedding: Array.from({ length: 4 }, (_, i) => i + idx + (model ? 0 : 0)) })) };
        }
      };
    }
  };
});

describe('OpenAIEmbeddings (mocked)', () => {
  it('embed and embedBatch forward to client and set dimension', async () => {
    const emb = new OpenAIEmbeddings({ apiKey: 'fake', model: 'text-embedding-3-small' });
    const v = await emb.embed('hello');
    expect(Array.isArray(v)).toBe(true);
    expect(emb.dimension).toBe(v.length);

    const batch = await emb.embedBatch(['a', 'b']);
    expect(batch.length).toBe(2);
    expect(emb.dimension).toBe(batch[0].length);
  });
});
