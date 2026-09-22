import type { Rule } from './types';
import { arrOf, boolOf, buildFinding, numOf, strOf } from './types';
import { CHECK_IDS } from '../contracts';
import type { EvidenceRecord } from '../evidence';
import type { JsonValue } from '../evidence';

const VERSION = '1.0.0';

export const noPrivacyLinkRule: Rule = {
  id: 'privacy.no-privacy-link',
  version: VERSION,
  title: 'No privacy-policy link was found in the delivered homepage HTML',
  category: 'privacy',
  severity: 'review',
  standards: ['EU GDPR Articles 12–14 (transparency) — review indicator only, not a legal determination'],
  evaluate(index, ctx) {
    const presence = index.first(CHECK_IDS.privacyLinkPresence('privacy'));
    if (presence === undefined || presence.state !== 'OBSERVED') return null;
    if (boolOf(presence, 'found') !== false) return null;
    return buildFinding({
      rule: noPrivacyLinkRule,
      state: 'OBSERVED',
      confidence: 'medium',
      summary: `No link whose address or label indicates a privacy policy was found in the homepage HTML delivered to a first-time visitor at ${ctx.targetUrl}. This is an observable privacy indicator requiring review.`,
      whyItMatters:
        'Many privacy frameworks expect a publicly reachable privacy notice for sites that process personal data. A missing link is an indicator to review; it is not, on its own, a legal conclusion.',
      howToReproduce: [
        `Fetch the homepage: curl -s ${ctx.targetUrl}`,
        'Search the HTML for links containing privacy, datenschutz, privacidad or similar terms in the href or visible label.',
      ],
      howToFix:
        'If a privacy notice exists, add a clearly labelled link to it from the site footer or main navigation. If none exists, review whether one is required for the data the site processes.',
      clientExplanation:
        'We could not find a visible link to a privacy statement on the home page. It may exist under another name or appear only after accepting cookies. This is worth checking, because visitors and regulators commonly expect it to be easy to find.',
      evidenceIds: [presence.evidenceId],
      limitations: [
        'Presence is judged by pattern matching over the delivered homepage HTML; JavaScript-rendered menus or unusual wording can hide a real link.',
      ],
    });
  },
};

export const privacyPageUnreachableRule: Rule = {
  id: 'privacy.privacy-page-unreachable',
  version: VERSION,
  title: 'The privacy-policy link did not lead to a reachable page',
  category: 'privacy',
  severity: 'review',
  standards: ['EU GDPR Articles 12–14 (transparency) — review indicator only, not a legal determination'],
  evaluate(index, ctx) {
    const page = index.first(CHECK_IDS.privacyPageReachability);
    if (page === undefined) return null;
    const status = numOf(page, 'status') ?? 0;
    const failed = page.state === 'ERROR' || status >= 400;
    if (!failed) return null;

    const url = strOf(page, 'url') ?? page.subject;
    const statusText = page.state === 'ERROR' ? 'the request failed' : `the page returned HTTP ${status}`;
    return buildFinding({
      rule: privacyPageUnreachableRule,
      state: page.state === 'ERROR' ? 'ERROR' : 'OBSERVED',
      confidence: 'high',
      summary: `The privacy-policy link found on ${ctx.targetUrl} (${url}) could not be loaded: ${statusText}.`,
      whyItMatters:
        'A privacy notice that is linked but unreachable offers no practical transparency to visitors. This is an availability observation about the linked page, not a legal conclusion.',
      howToReproduce: [
        `Run: curl -sI ${url}`,
        'Check the returned status code and confirm the page loads in a normal browser.',
      ],
      howToFix:
        'Repair or replace the privacy-policy link so it resolves to a live page, and re-run the audit to confirm.',
      clientExplanation:
        'The privacy link on the home page does not currently open a working page. This is usually a quick fix: check the link address or republish the page, then test it in a browser.',
      evidenceIds: [page.evidenceId],
      limitations: ['One request to the first privacy link found; a second policy page could exist elsewhere.'],
    });
  },
};

export const consentIndicatorNotDetectedRule: Rule = {
  id: 'privacy.consent-indicator-not-detected',
  version: VERSION,
  title: 'No commonly-used consent-management indicator was detected',
  category: 'privacy',
  severity: 'informational',
  standards: [],
  evaluate(index, ctx) {
    const consent = index.first(CHECK_IDS.consentIndicator);
    if (consent === undefined || consent.state !== 'OBSERVED') return null;
    const tools = arrOf(consent, 'detectedTools');
    if (tools.length > 0) return null;
    return buildFinding({
      rule: consentIndicatorNotDetectedRule,
      state: 'INFERRED',
      confidence: 'low',
      summary: `The homepage HTML delivered at ${ctx.targetUrl} did not contain identifiers of widely used consent-management products. This is an indicator, not a statement about consent behaviour.`,
      whyItMatters:
        'Sites that set non-essential cookies in the EU/EEA commonly surface a consent mechanism. Consent can also be implemented in ways this passive check cannot see, or may not be required for the pages observed.',
      howToReproduce: [
        `Fetch the homepage: curl -s ${ctx.targetUrl}`,
        'Search the HTML and its script sources for names such as Cookiebot, OneTrust, Klaro, tarteaucitron, Osano, Iubenda or consentmanager.',
      ],
      howToFix:
        'If the site uses cookies or tracking that requires consent, verify that a consent mechanism is present and functioning when viewed as a first-time visitor. If it is already present in a form this check cannot see, no action is needed.',
      clientExplanation:
        'Our passive check did not recognise a standard cookie-consent tool on the home page. Many sites implement consent differently, so this is a prompt for a quick manual review rather than a problem by itself.',
      evidenceIds: [consent.evidenceId],
      limitations: [
        'Name-based indicator check over delivered HTML only; consent dialogs rendered after JavaScript execution can be missed.',
        'This is explicitly not a legal-compliance determination.',
      ],
    });
  },
};

export const cookieFlagsRule: Rule = {
  id: 'privacy.cookie-flags-incomplete',
  version: VERSION,
  title: 'Cookies were set without complete protective flags',
  category: 'privacy',
  severity: 'review',
  standards: ['OWASP Secure Cookie Attributes'],
  evaluate(index, ctx) {
    const cookies = index.first(CHECK_IDS.cookies);
    if (cookies === undefined || cookies.state !== 'OBSERVED') return null;
    const count = numOf(cookies, 'cookieCount') ?? 0;
    if (count === 0) return null;
    const withoutSecure = numOf(cookies, 'withoutSecure') ?? 0;
    const withoutHttpOnly = numOf(cookies, 'withoutHttpOnly') ?? 0;
    const withoutSameSite = numOf(cookies, 'withoutSameSite') ?? 0;
    if (withoutSecure === 0 && withoutHttpOnly === 0 && withoutSameSite === 0) return null;

    const parts: string[] = [];
    if (withoutSecure > 0) parts.push(`${withoutSecure} without the Secure flag`);
    if (withoutHttpOnly > 0) parts.push(`${withoutHttpOnly} without HttpOnly`);
    if (withoutSameSite > 0) parts.push(`${withoutSameSite} without SameSite`);
    const severity = withoutSecure > 0 ? 'review' : 'informational';

    return buildFinding({
      rule: cookieFlagsRule,
      state: 'OBSERVED',
      confidence: 'high',
      severity,
      summary: `The ${ctx.targetUrl} response set ${count} cookie(s): ${parts.join(', ')}. Cookie names and values were deliberately not stored.`,
      whyItMatters:
        'The Secure flag keeps cookies off plain-HTTP connections, HttpOnly hides them from scripts, and SameSite limits cross-site sending. Missing flags widen the exposure of session or tracking cookies.',
      howToReproduce: [
        `Run: curl -sI ${ctx.targetUrl}`,
        'Inspect the Set-Cookie lines and check for the Secure, HttpOnly and SameSite attributes.',
      ],
      howToFix:
        'Set Secure (required over HTTPS), HttpOnly for cookies that scripts do not need, and an explicit SameSite value on session cookies set by the application or CDN.',
      clientExplanation:
        'Some cookies sent when the home page loads are missing standard protective settings. The fix is usually a configuration change in the website platform or hosting panel; it is one of the cheapest hardening steps available.',
      evidenceIds: [cookies.evidenceId],
      limitations: ['Only cookies set on the site-root response were inspected; flags can differ per cookie.'],
    });
  },
};

export const privacyRules: Rule[] = [
  noPrivacyLinkRule,
  privacyPageUnreachableRule,
  consentIndicatorNotDetectedRule,
  cookieFlagsRule,
];

export function cookieFlagJson(record: EvidenceRecord): JsonValue {
  return record.data;
}
