import type { ScanContext } from '../contracts';
import type { HttpExchange } from '../transport/client';

export interface HomepageHtml {
  exchange: HttpExchange;
  html: string | null;
  reason: 'ok' | 'error' | 'no-body' | 'not-html';
  contentType: string | null;
}

export async function getHomepageHtml(ctx: ScanContext): Promise<HomepageHtml> {
  const exchange = await ctx.http.request(ctx.target.httpsUrl, { method: 'GET' });
  const contentType = exchange.headers['content-type'] ?? null;
  if (exchange.error !== undefined) {
    return { exchange, html: null, reason: 'error', contentType };
  }
  if (exchange.bodyText === undefined || exchange.bodyText.length === 0) {
    return { exchange, html: null, reason: 'no-body', contentType };
  }
  if (contentType !== null && !/text\/html|application\/xhtml/i.test(contentType)) {
    return { exchange, html: null, reason: 'not-html', contentType };
  }
  return { exchange, html: exchange.bodyText, reason: 'ok', contentType };
}

export function contentTypeOf(exchange: HttpExchange): string | null {
  return exchange.headers['content-type'] ?? null;
}
