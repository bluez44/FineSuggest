import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import type { DocumentLoader } from '@/lib/ingestion/loaders/DocumentLoader';
import { IngestionError, type LoaderInput, type RawDoc } from '@/lib/ingestion/types';

export class UrlLoader implements DocumentLoader {
  constructor(private opts: { fetcher?: typeof fetch } = {}) {}

  async load(input: LoaderInput): Promise<RawDoc> {
    if (input.kind !== 'url') {
      throw new IngestionError('UrlLoader only accepts url input', 'load');
    }
    const fetcher = this.opts.fetcher ?? fetch;

    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetcher(input.url, {
        redirect: 'follow',
        headers: { 'user-agent': 'FineSuggest/1.0' },
      });
    } catch (err) {
      throw new IngestionError(`Failed to fetch URL ${input.url}`, 'load', err);
    }
    if (!response.ok) {
      throw new IngestionError(`URL fetch failed with status ${response.status}`, 'load');
    }

    // linkedom is a lightweight DOM shim without jsdom's broken ESM dep chain
    // (html-encoding-sniffer → @exodus/bytes), so it works on Vercel serverless.
    // For Readability's text extraction we don't need jsdom's full browser stack.
    const html = await response.text();
    const { document } = parseHTML(html);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const article = new Readability(document as any).parse();

    if (!article?.textContent) {
      throw new IngestionError('No readable article found at URL', 'load');
    }

    const content = article.textContent.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    return {
      content,
      metadata: {
        sourceType: 'url',
        title: article.title || input.url,
        sourceUrl: input.url,
      },
    };
  }
}
