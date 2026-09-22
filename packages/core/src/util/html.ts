import { CONSENT_SIGNATURES } from '../signatures';
import { truncate } from './hash';

export type LegalClass = 'privacy' | 'terms' | 'legal' | 'cookies' | 'contact' | 'accessibility';

export interface PageLink {
  rawHref: string;
  resolved: string | null;
  kind: 'internal' | 'external' | 'special';
  legalClass: LegalClass | null;
  text: string;
}

export interface PageSignals {
  title: string | null;
  htmlLang: string | null;
  viewport: string | null;
  generator: string | null;
  links: PageLink[];
  scriptSrcs: string[];
  inlineScriptBytes: number;
  imagesTotal: number;
  imagesMissingAlt: number;
  consentTools: string[];
  hasCookieWord: boolean;
}

const LEGAL_PATTERNS: { cls: LegalClass; pattern: RegExp }[] = [
  {
    cls: 'privacy',
    pattern:
      /privacy|privacidad|privacidade|datenschutz|confidentialit|privacybeleid|privacyverklaring|integritetspolicy|personvern|gizlilik|privatliv/i,
  },
  { cls: 'cookies', pattern: /cookie/i },
  {
    cls: 'terms',
    pattern: /terms|tos\b|agb\b|condiciones|voorwaarden|conditions-generales|condizioni|termos/i,
  },
  { cls: 'legal', pattern: /impressum|imprint|aviso-legal|mentions-legales|legal-notice|rechtliche|disclaimer/i },
  { cls: 'contact', pattern: /contact|kontakt|contacto|contatti/i },
  { cls: 'accessibility', pattern: /accessib|toegankelijk|barrierefrei/i },
];

/**
 * Deliberately simple, dependency-free extraction. It handles the link and
 * meta shapes that dominate real marketing sites. Known limitation: heavily
 * templated or script-generated navigation may be missed (recorded in the
 * finding limitations and in docs/LIMITATIONS notes).
 */
export function extractPageSignals(html: string, baseUrl: string): PageSignals {
  const base = safeUrl(baseUrl);
  const links: PageLink[] = [];

  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const attrs = match[1] ?? '';
    const inner = match[2] ?? '';
    const rawHref = extractAttr(attrs, 'href');
    if (rawHref === null) continue;
    const resolved = base === null ? null : resolveHref(rawHref, base);
    links.push({
      rawHref,
      resolved,
      kind: classifyLink(rawHref, resolved, base),
      legalClass: classifyLegal(resolved ?? rawHref),
      text: truncate(stripTags(inner).trim().replace(/\s+/g, ' '), 120),
    });
  }

  const scriptSrcs: string[] = [];
  let inlineScriptBytes = 0;
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const attrs = match[1] ?? '';
    const inner = match[2] ?? '';
    const src = extractAttr(attrs, 'src');
    if (src !== null) {
      scriptSrcs.push(src);
    } else {
      inlineScriptBytes += inner.length;
    }
  }

  let imagesTotal = 0;
  let imagesMissingAlt = 0;
  const imagePattern = /<img\b([^>]*)>/gi;
  for (const match of html.matchAll(imagePattern)) {
    imagesTotal += 1;
    const attrs = match[1] ?? '';
    if (extractAttr(attrs, 'alt') === null) imagesMissingAlt += 1;
  }

  const consentTools = CONSENT_SIGNATURES.filter((signature) => signature.pattern.test(html)).map(
    (signature) => signature.label,
  );

  return {
    title: truncate(cleanText(firstGroup(html, /<title[^>]*>([\s\S]*?)<\/title>/i)), 160),
    htmlLang: cleanText(
      firstGroup(html, /<html\b[^>]*?\blang\s*=\s*(?:"([^"]*)"|'([^']*)')/i, 2),
    ),
    viewport: /<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(html) ? 'present' : null,
    generator: cleanText(
      firstGroup(
        html,
        /<meta\b[^>]*\bname\s*=\s*["']generator["'][^>]*\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
        2,
      ),
    ),
    links,
    scriptSrcs,
    inlineScriptBytes,
    imagesTotal,
    imagesMissingAlt,
    consentTools,
    hasCookieWord: /cookie/i.test(html),
  };
}

export function findPatternExcerpt(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text);
  if (match === null) return null;
  const index = match.index;
  const start = Math.max(0, index - 48);
  const end = Math.min(text.length, index + match[0].length + 48);
  return truncate(text.slice(start, end).replace(/\s+/g, ' '), 200);
}

export function legalClassOf(url: string | null): LegalClass | null {
  if (url === null) return null;
  return classifyLegal(url);
}

function classifyLegal(url: string): LegalClass | null {
  const path = pathAndQuery(url).toLowerCase();
  for (const { cls, pattern } of LEGAL_PATTERNS) {
    if (pattern.test(path)) return cls;
  }
  return null;
}

function classifyLink(rawHref: string, resolved: string | null, base: URL | null): PageLink['kind'] {
  const lowered = rawHref.trim().toLowerCase();
  if (lowered.startsWith('#') || lowered.startsWith('mailto:') || lowered.startsWith('tel:') || lowered.startsWith('javascript:') || lowered.startsWith('data:')) {
    return 'special';
  }
  if (resolved === null || base === null) return 'external';
  const host = safeUrl(resolved)?.hostname ?? '';
  return host === base.hostname ? 'internal' : 'external';
}

function pathAndQuery(url: string): string {
  const parsed = safeUrl(url);
  if (parsed === null) return url;
  return `${parsed.pathname}${parsed.search}`;
}

function resolveHref(rawHref: string, base: URL): string | null {
  try {
    return new URL(decodeEntities(rawHref.trim()), base).href;
  } catch {
    return null;
  }
}

function safeUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function extractAttr(attrs: string, name: string): string | null {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\\`]+))`, 'i');
  const match = pattern.exec(attrs);
  if (match === null) return null;
  return match[1] ?? match[2] ?? match[3] ?? '';
}

function firstGroup(text: string, pattern: RegExp, allowedGroup = 1): string | null {
  const match = pattern.exec(text);
  if (match === null) return null;
  return match[allowedGroup] ?? match[1] ?? null;
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '));
}

function cleanText(value: string | null): string | null {
  if (value === null) return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned.length === 0 ? null : cleaned;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}
