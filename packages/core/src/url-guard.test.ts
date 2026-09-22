import { describe, expect, it } from 'vitest';
import { checkHostname, isAllowedRedirectUrl, normalizeTargetInput } from './url-guard';

describe('target normalization', () => {
  it('adds https to a bare domain and builds both scheme URLs', () => {
    const result = normalizeTargetInput('example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.target.hostname).toBe('example.com');
      expect(result.target.httpsUrl).toBe('https://example.com/');
      expect(result.target.httpUrl).toBe('http://example.com/');
    }
  });

  it('accepts an https URL and keeps the host, ignoring the path', () => {
    const result = normalizeTargetInput('https://example.com/some/page?q=1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.target.httpsUrl).toBe('https://example.com/');
    }
  });

  it('accepts recorded fixture domains under reserved .test TLDs', () => {
    const result = normalizeTargetInput('https://healthy-site.test/');
    expect(result.ok).toBe(true);
  });

  it('rejects empty input and nonsense', () => {
    expect(normalizeTargetInput('   ').ok).toBe(false);
    expect(normalizeTargetInput('not a domain at all').ok).toBe(false);
  });

  it('rejects non-http schemes, credentials and non-standard ports', () => {
    expect(normalizeTargetInput('ftp://example.com').ok).toBe(false);
    expect(normalizeTargetInput('file:///etc/passwd').ok).toBe(false);
    expect(normalizeTargetInput('https://user:pass@example.com').ok).toBe(false);
    expect(normalizeTargetInput('https://example.com:8080').ok).toBe(false);
  });

  it('rejects local, private and reserved hosts', () => {
    const rejected = [
      'localhost',
      'http://localhost:80/',
      'http://127.0.0.1/',
      'http://10.1.2.3/',
      'http://172.20.10.5/',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]/',
      'http://[fd00::1]/',
      'http://metadata.google.internal/',
      'http://printer.local/',
      'http://example.onion/',
    ];
    for (const target of rejected) {
      expect(normalizeTargetInput(target).ok, target).toBe(false);
    }
  });

  it('allows public IP literals but keeps reserved ranges rejected', () => {
    expect(normalizeTargetInput('http://93.184.216.34/').ok).toBe(true);
    expect(normalizeTargetInput('http://203.0.113.10/').ok).toBe(false);
  });
});

describe('hostname checks', () => {
  it('rejects single-label hostnames', () => {
    expect(checkHostname('intranet').allowed).toBe(false);
  });

  it('allows multi-label public names', () => {
    expect(checkHostname('shop.example.co.uk').allowed).toBe(true);
  });
});

describe('redirect validation', () => {
  it('allows public https redirects', () => {
    expect(isAllowedRedirectUrl('https://example.com/login')).toBe(true);
  });

  it('blocks redirects into private space and non-http schemes', () => {
    expect(isAllowedRedirectUrl('http://169.254.169.254/')).toBe(false);
    expect(isAllowedRedirectUrl('https://localhost/')).toBe(false);
    expect(isAllowedRedirectUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedRedirectUrl('https://user:pass@example.com/')).toBe(false);
  });
});
