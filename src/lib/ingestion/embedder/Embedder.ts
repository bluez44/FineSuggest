/** Strategy: produce a 768-dim embedding for each input string, in order. */
export interface Embedder {
  /** Returns one vector per input text, same order. Every vector MUST have length 768. */
  embedBatch(texts: string[]): Promise<number[][]>;
}
