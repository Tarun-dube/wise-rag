import { Document } from '../core/interfaces';

export class TextSplitter {
  constructor(public chunkSize = 1000, public chunkOverlap = 200) {
    if (chunkOverlap >= chunkSize) throw new Error('chunkOverlap must be smaller than chunkSize');
  }

  /** Split a single text into chunked pieces (string array). */
  splitText(text: string): string[] {
    // First, naive sentence split to avoid cutting sentences when possible.
    const sentences = text
      .replace(/\r\n/g, '\n')
      .split(/(?<=[.?!])\s+|\n+/)
      .map(s => s.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    let current = '';

    for (const sent of sentences) {
      if (current.length + sent.length + 1 <= this.chunkSize) {
        current = current ? `${current} ${sent}` : sent;
      } else {
        if (current) chunks.push(current);
        // If single sentence is larger than chunk, break it
        if (sent.length > this.chunkSize) {
          for (let i = 0; i < sent.length; i += this.chunkSize - this.chunkOverlap) {
            chunks.push(sent.slice(i, i + this.chunkSize));
          }
          current = '';
        } else {
          current = sent;
        }
      }
    }
    if (current) chunks.push(current);

    // Add overlap: create sliding-window style chunks to ensure overlap between neighbors
    if (this.chunkOverlap > 0) {
      const overlapped: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const base = chunks[i];
        let composed = base;
        if (i > 0) {
          const prev = chunks[i - 1];
          const keep = Math.min(this.chunkOverlap, prev.length);
          composed = prev.slice(prev.length - keep) + ' ' + base;
        }
        overlapped.push(composed);
      }
      return overlapped;
    }

    return chunks;
  }

  /** Convenience: split into Document objects (auto id generation optional). */
  splitToDocuments(text: string, baseId?: string): Document[] {
    const parts = this.splitText(text);
    return parts.map((p, i) => ({ id: baseId ? `${baseId}::${i}` : undefined, content: p }));
  }
}

export default TextSplitter;
