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

// Purple-team regressions: forms the WHATWG URL parser produces that a string denylist can miss.
describe('SSRF bypass regressions', () => {
  const blocked = [
    'http://[::ffff:127.0.0.1]/', // parser rewrites to [::ffff:7f00:1]
    'http://[::ffff:169.254.169.254]/', // cloud metadata via mapped hex form
    'http://[::ffff:10.0.0.1]/',
    'http://[::127.0.0.1]/', // IPv4-compatible, rewritten to [::7f00:1]
    'http://[64:ff9b::a9fe:a9fe]/', // NAT64 to 169.254.169.254
    'http://[2002:7f00:1::]/', // 6to4 embedding 127.0.0.1
    'http://[0:0:0:0:0:0:0:1]/', // loopback spelled out
    'http://localhost./', // trailing dot
    'http://foo.localhost./',
    'http://metadata.google.internal./',
    'http://printer.local./',
    'http://2130706433/', // decimal 127.0.0.1
    'http://0x7f.1/', // hex shorthand
    'http://017700000001/', // octal
  ];

  it.each(blocked)('rejects %s as a target and as a redirect hop', (url) => {
    expect(normalizeTargetInput(url).ok).toBe(false);
    expect(isAllowedRedirectUrl(url)).toBe(false);
  });

  it.each(['https://example.com./', 'http://[2606:4700:4700::1111]/', 'http://[::ffff:8.8.8.8]/'])(
    'still accepts public %s',
    (url) => {
      expect(normalizeTargetInput(url).ok).toBe(true);
      expect(isAllowedRedirectUrl(url)).toBe(true);
    },
  );

  it('normalizes a trailing dot away from the audited hostname', () => {
    const result = normalizeTargetInput('https://example.com./');
    expect(result.ok && result.target.hostname).toBe('example.com');
  });
});

describe('checkHostname on raw IPv6 spellings', () => {
  it.each(['::ffff:127.0.0.1', '::127.0.0.1', '[::1]', '::ffff:7f00:1', 'fe80::1', 'fd00::1', 'ff02::1', '2001:db8::1'])(
    'denies %s',
    (host) => {
      expect(checkHostname(host).allowed).toBe(false);
    },
  );

  it.each(['::ffff:8.8.8.8', '2606:4700:4700::1111', '2a00:1450:4001:80b::200e'])('allows %s', (host) => {
    expect(checkHostname(host).allowed).toBe(true);
  });

  it('rejects malformed IPv6', () => {
    expect(checkHostname('1::2::3').allowed).toBe(false);
    expect(checkHostname('12345::1').allowed).toBe(false);
  });
});
