import { describe, it, expect } from 'vitest';
import { SplitterFactory } from '@/lib/ingestion/splitters/SplitterFactory';
import { VietnameseLawSplitter } from '@/lib/ingestion/splitters/VietnameseLawSplitter';
import { RecursiveSplitter } from '@/lib/ingestion/splitters/RecursiveSplitter';
import type { RawDoc } from '@/lib/ingestion/types';

const asDoc = (content: string): RawDoc => ({
  content,
  metadata: { sourceType: 'txt', title: 'x.txt' },
});

describe('SplitterFactory', () => {
  const factory = new SplitterFactory();

  it('picks VietnameseLawSplitter when text has 2+ Điều markers', () => {
    const s = factory.forDoc(asDoc('Điều 1. ...\nĐiều 2. ...'));
    expect(s).toBeInstanceOf(VietnameseLawSplitter);
  });

  it('picks RecursiveSplitter when no Điều markers', () => {
    const s = factory.forDoc(asDoc('Hello world, no legal structure here.'));
    expect(s).toBeInstanceOf(RecursiveSplitter);
  });

  it('picks RecursiveSplitter with only 1 Điều (not enough signal)', () => {
    const s = factory.forDoc(asDoc('Điều 1. Standalone.'));
    expect(s).toBeInstanceOf(RecursiveSplitter);
  });
});
