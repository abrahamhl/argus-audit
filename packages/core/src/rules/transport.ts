import type { Rule } from './types';
import { buildFinding, boolOf, numOf, responseUsable, strOf } from './types';
import { CHECK_IDS } from '../contracts';

const VERSION = '1.0.0';

export const httpsUnreachableRule: Rule = {
  id: 'availability.https-unreachable',
  version: VERSION,
  title: 'HTTPS request did not complete',
  category: 'availability',
  severity: 'critical',
  standards: ['OWASP Transport Layer Security Cheat Sheet'],
  evaluate(index, ctx) {
    const record = index.first(CHECK_IDS.httpsReachable);
    if (record === undefined || record.state !== 'ERROR') return null;
    const code = strOf(record, 'error') === null ? 'UNKNOWN' : readErrorCode(record);
    return buildFinding({
      rule: httpsUnreachableRule,
      state: 'ERROR',
      confidence: 'high',
      summary: `An HTTPS request to ${ctx.targetUrl} did not complete (${code}). The check is reported as an error, not as evidence that the site is down.`,
      whyItMatters:
        'A failed HTTPS request can mean a temporary network problem, a blocking rule against automated clients, or a real outage. It is reported because the audit could not use the primary transport channel.',
      howToReproduce: [
        `From your own network run: curl -sS -o /dev/null -w "%{http_code}" ${ctx.targetUrl}`,
        'Compare from a second network (for example mobile data) to distinguish temporary or local blocking from a persistent failure.',
      ],
      howToFix:
        'If the failure is persistent, check hosting, DNS and TLS configuration for the domain. If it is not persistent, no action is required on the site.',
      clientExplanation:
        'Our automated visit to the website could not complete. This can happen because of a temporary network problem or a protection service that blocks automated visits. It is worth a quick manual check in your own browser; no conclusion is drawn beyond that.',
      evidenceIds: [record.evidenceId],
      limitations: [record.limitations.join(' ') || 'Single network vantage point.'],
    });
  },
};

export const noHttpsRedirectRule: Rule = {
  id: 'transport.no-https-redirect',
  version: VERSION,
  title: 'Plain HTTP was answered without redirecting to HTTPS',
  category: 'transport-security',
  severity: 'review',
  standards: ['OWASP Transport Layer Security Cheat Sheet'],
  evaluate(index, ctx) {
    const reachable = index.first(CHECK_IDS.httpsReachable);
    const redirect = index.first(CHECK_IDS.httpRedirect);
    if (reachable === undefined || reachable.state !== 'OBSERVED') return null;
    if (redirect === undefined || redirect.state !== 'OBSERVED') return null;
    if (!responseUsable(index.first(CHECK_IDS.httpResponse))) return null;
    const upgraded = boolOf(redirect, 'upgradedToHttps');
    if (upgraded !== false) return null;
    const status = numOf(redirect, 'status');
    return buildFinding({
      rule: noHttpsRedirectRule,
      state: 'OBSERVED',
      confidence: 'high',
      summary: `A request to ${ctx.targetUrl.replace('https://', 'http://')} received an HTTP response (status ${status ?? 'unknown'}) without being redirected to HTTPS.`,
      whyItMatters:
        'When plain HTTP is answered directly, a visitor who types or follows an http:// link can be served content without transport encryption. HTTPS enforcement via redirect closes that path.',
      howToReproduce: [
        `Run: curl -sI http://${ctx.targetUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}/`,
        'Check whether the response is a redirect (3xx with a Location header starting with https://) or a direct 200 response.',
      ],
      howToFix:
        'Configure the web server or CDN to redirect all http:// requests to the same URL over https://, then resubmit the audit to confirm.',
      clientExplanation:
        'Visitors who reach the site over an old http:// link are not automatically sent to the secure version. Most hosting panels and CDNs can enable this redirect with a single setting.',
      evidenceIds: [redirect.evidenceId, reachable.evidenceId],
    });
  },
};

export const hstsNotObservedRule: Rule = {
  id: 'transport.hsts-not-observed',
  version: VERSION,
  title: 'Strict-Transport-Security header was not observed',
  category: 'transport-security',
  severity: 'review',
  standards: ['RFC 6797 — HTTP Strict Transport Security'],
  evaluate(index, ctx) {
    const reachable = index.first(CHECK_IDS.httpsReachable);
    const hsts = index.first(CHECK_IDS.hsts);
    if (reachable === undefined || reachable.state !== 'OBSERVED') return null;
    if (hsts === undefined || hsts.state !== 'OBSERVED') return null;
    if (!responseUsable(index.first(CHECK_IDS.httpsResponse))) return null;
    if (boolOf(hsts, 'present') !== false) return null;
    return buildFinding({
      rule: hstsNotObservedRule,
      state: 'OBSERVED',
      confidence: 'medium',
      summary: `The observed HTTPS response from ${ctx.targetUrl} did not include a Strict-Transport-Security header.`,
      whyItMatters:
        'HSTS tells browsers to use HTTPS for this domain for a defined period, reducing downgrade and cookie-hijacking risk. Its absence is a common hardening gap, not by itself a vulnerability.',
      howToReproduce: [
        `Run: curl -sI ${ctx.targetUrl}`,
        'Check whether the response includes a Strict-Transport-Security header.',
      ],
      howToFix:
        'After confirming that every subdomain serves valid HTTPS, add a header such as: Strict-Transport-Security: max-age=31536000; includeSubDomains. Start with a short max-age while testing.',
      clientExplanation:
        'The site works over HTTPS, but browsers are not yet told to always require it for future visits. Adding one response header (HSTS) removes that small downgrade window; your web host or CDN usually documents how.',
      evidenceIds: [hsts.evidenceId],
      limitations: ['Absence was observed in one response to the site root; configuration can differ per route.'],
    });
  },
};

export const transportRules: Rule[] = [httpsUnreachableRule, noHttpsRedirectRule, hstsNotObservedRule];

function readErrorCode(record: { data: unknown }): string {
  const data = record.data;
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const error = (data as Record<string, unknown>)['error'];
    if (error !== null && typeof error === 'object' && !Array.isArray(error)) {
      const code = (error as Record<string, unknown>)['code'];
      if (typeof code === 'string') return code;
    }
  }
  return 'UNKNOWN';
}
