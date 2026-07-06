import { describe, it, expect, vi } from 'vitest';
import { UrlLoader } from '@/lib/ingestion/loaders/UrlLoader';

const htmlWithArticle = `
<html>
  <head><title>Nghị định 100/2019</title></head>
  <body>
    <nav>skip me</nav>
    <article>
      <h1>Nghị định 100/2019</h1>
      <p>Điều 5. Vượt đèn đỏ với xe máy: phạt tiền 800.000 đồng.</p>
      <p>Điều 6. Không đội mũ bảo hiểm: phạt 400.000 đồng.</p>
    </article>
    <footer>skip me too</footer>
  </body>
</html>`;

function fakeFetch(html: string) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => html,
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
  })) as unknown as typeof fetch;
}

describe('UrlLoader', () => {
  it('fetches URL, extracts article text, and stores URL in metadata', async () => {
    const loader = new UrlLoader({ fetcher: fakeFetch(htmlWithArticle) });
    const doc = await loader.load({ kind: 'url', url: 'https://example.com/nghi-dinh' });

    expect(doc.metadata.sourceType).toBe('url');
    expect(doc.metadata.title).toContain('Nghị định 100/2019');
    expect(doc.metadata.sourceUrl).toBe('https://example.com/nghi-dinh');
    expect(doc.content).toContain('Điều 5');
    expect(doc.content).toContain('Điều 6');
    expect(doc.content).not.toContain('skip me');
  });

  it('throws on non-2xx response', async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      status: 404,
      text: async () => '',
      headers: new Headers(),
    })) as unknown as typeof fetch;
    const loader = new UrlLoader({ fetcher });
    await expect(
      loader.load({ kind: 'url', url: 'https://example.com/404' }),
    ).rejects.toThrow(/404/);
  });

  it('throws on kind=buffer input', async () => {
    const loader = new UrlLoader({ fetcher: fakeFetch('') });
    await expect(
      loader.load({
        kind: 'buffer',
        buffer: Buffer.from(''),
        filename: 'x',
        mimeType: 'text/html',
      }),
    ).rejects.toThrow(/UrlLoader/);
  });
});
