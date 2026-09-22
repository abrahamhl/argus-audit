import { describe, expect, it } from 'vitest';
import { extractPageSignals, findPatternExcerpt } from './html';

const HTML = `<!doctype html><html lang='nl'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width'><meta name='generator' content='WordPress 6.5'><title>Bakkerij Voorbeeld</title></head><body><nav><a href='/privacybeleid'>Privacybeleid</a><a href='/impressum'>Impressum</a><a href='https://extern.example/'>Extern</a><a href='#top'>Top</a><a href='mailto:info@example.nl'>Mail</a></nav><main><img src='/a.jpg' alt='Brood'><img src='/b.jpg'><img src='/c.jpg' alt=''></main></body></html>`;

describe('page signal extraction', () => {
  const signals = extractPageSignals(HTML, 'https://bakkerij.test/');

  it('extracts title, language, viewport and generator', () => {
    expect(signals.title).toBe('Bakkerij Voorbeeld');
    expect(signals.htmlLang).toBe('nl');
    expect(signals.viewport).not.toBeNull();
    expect(signals.generator).toContain('WordPress');
  });

  it('classifies links and legal pages', () => {
    const privacy = signals.links.find((link) => link.rawHref === '/privacybeleid');
    const impressum = signals.links.find((link) => link.rawHref === '/impressum');
    const external = signals.links.find((link) => link.rawHref.startsWith('https://extern'));
    const anchor = signals.links.find((link) => link.rawHref === '#top');
    const mail = signals.links.find((link) => link.rawHref.startsWith('mailto:'));

    expect(privacy?.legalClass).toBe('privacy');
    expect(privacy?.kind).toBe('internal');
    expect(impressum?.legalClass).toBe('legal');
    expect(external?.kind).toBe('external');
    expect(anchor?.kind).toBe('special');
    expect(mail?.kind).toBe('special');
  });

  it('counts images without alt but treats empty alt as intentional', () => {
    expect(signals.imagesTotal).toBe(3);
    expect(signals.imagesMissingAlt).toBe(1);
  });

  it('resolves relative links against the base URL', () => {
    const privacy = signals.links.find((link) => link.rawHref === '/privacybeleid');
    expect(privacy?.resolved).toBe('https://bakkerij.test/privacybeleid');
  });
});

describe('pattern excerpts', () => {
  it('returns surrounding context for a match and null otherwise', () => {
    expect(findPatternExcerpt('the word cookie appears here', /cookie/i)).toContain('cookie');
    expect(findPatternExcerpt('nothing relevant', /cookie/i)).toBeNull();
  });
});
