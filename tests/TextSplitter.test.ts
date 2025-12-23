import { describe, it, expect } from 'vitest';
import { TextSplitter } from '../src/splitters/TextSplitter';

describe('TextSplitter', () => {
  it('throws when overlap >= chunkSize', () => {
    expect(() => new TextSplitter(100, 100)).toThrow();
  });

  it('splits text into chunks with overlap', () => {
    const t = new TextSplitter(20, 6);
    const text = 'This is sentence one. This is sentence two that is longer. Short.';
    const parts = t.splitText(text);
    // ensure we have chunks and overlap applied
    expect(parts.length).toBeGreaterThan(0);
    if (parts.length >= 2) {
      const a = parts[0];
      const b = parts[1];
      // overlap should be present (suffix of a included in b)
      expect(b.includes(a.slice(Math.max(0, a.length - 6)))).toBe(true);
    }
  });

  it('splits very long sentence into multiple chunks', () => {
    const long = 'x'.repeat(250);
    const t = new TextSplitter(100, 10);
    const parts = t.splitText(long);
    expect(parts.length).toBeGreaterThan(1);
    // ensure chunks are not longer than chunkSize + overlap allowance
  for (const p of parts) expect(p.length).toBeLessThanOrEqual(111);
  });

  it('splits long text into chunks with overlap (larger sample)', () => {
    const t = new TextSplitter(50, 10);
    const text = Array(10).fill('This is a sentence.').join(' ');
    const parts = t.splitText(text);
    expect(parts.length).toBeGreaterThan(0);
    // ensure none exceed chunkSize + small allowance for overlap glue
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(70);
  });
});
