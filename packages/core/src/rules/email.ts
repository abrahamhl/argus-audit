import type { Rule } from './types';
import { buildFinding, dataOf } from './types';
import { CHECK_IDS } from '../contracts';
import type { EvidenceIndex } from './types';
import type { EvidenceRecord } from '../evidence';

const VERSION = '1.0.0';

function dns(record: EvidenceRecord, key: string): Record<string, unknown> {
  const value = dataOf(record)[key];
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function summaryOf(index: EvidenceIndex): EvidenceRecord | null {
  const record = index.first(CHECK_IDS.dnsSummary);
  return record !== undefined && record.state === 'OBSERVED' ? record : null;
}

function evidenceIds(index: EvidenceIndex, summary: EvidenceRecord, type: string): string[] {
  const answer = index.first(CHECK_IDS.dnsAnswer(type));
  return answer === undefined ? [summary.evidenceId] : [summary.evidenceId, answer.evidenceId];
}

export const spfMissingRule: Rule = {
  id: 'email.spf-missing',
  version: VERSION,
  title: 'No SPF record was found',
  category: 'content-quality',
  severity: 'review',
  standards: ['RFC 7208 — Sender Policy Framework'],
  evaluate(index, ctx) {
    const summary = summaryOf(index);
    if (summary === null) return null;
    const statuses = dns(summary, 'statuses');
    if (statuses['TXT'] !== 'OK') return null;
    const spf = dns(summary, 'spf');
    if (spf['present'] !== false) return null;
    return buildFinding({
      rule: spfMissingRule,
      state: 'OBSERVED',
      confidence: 'high',
      summary: `The TXT records published for ${ctx.targetUrl.replace('https://', '').replace(/\/$/, '')} do not contain an SPF record.`,
      whyItMatters:
        'SPF lets receiving mail servers check whether a sender was authorised by the domain. Without it, forged sender addresses using this domain are harder to distinguish from legitimate mail.',
      howToReproduce: [
        `Query the TXT records, for example: dig TXT ${ctx.targetUrl.replace('https://', '').replace(/\/$/, '')} +short`,
        'Look for a record starting with v=spf1. Its absence is the observation behind this finding.',
      ],
      howToFix:
        'Publish one SPF record listing the systems that send mail for the domain and ending with a strict or soft fail, for example: v=spf1 include:your-provider.example -all. Keep it under the DNS lookup limit.',
      clientExplanation:
        'The domain does not publish an SPF record, one of the two standard signals mail servers use to spot forged email pretending to come from the business. It is a common gap and a straightforward DNS addition with help from the mail provider.',
      evidenceIds: evidenceIds(index, summary, 'TXT'),
      limitations: ['Only the apex domain TXT records were queried, once, through one resolver.'],
    });
  },
};

export const spfWeakRule: Rule = {
  id: 'email.spf-weak-all',
  version: VERSION,
  title: 'The SPF record does not strictly reject unauthorised senders',
  category: 'content-quality',
  severity: 'review',
  standards: ['RFC 7208 — Sender Policy Framework'],
  evaluate(index, ctx) {
    const summary = summaryOf(index);
    if (summary === null) return null;
    const spf = dns(summary, 'spf');
    if (spf['present'] !== true) return null;
    const qualifier = spf['allQualifier'];
    if (qualifier === '-' || qualifier === null || qualifier === undefined) return null;
    const label = qualifier === '~' ? '~all (soft fail)' : `${String(qualifier)}all`;
    return buildFinding({
      rule: spfWeakRule,
      state: 'OBSERVED',
      confidence: 'high',
      summary: `The SPF record for ${ctx.targetUrl.replace('https://', '').replace(/\/$/, '')} ends with ${label}, which does not reject unauthorised senders outright.`,
      whyItMatters:
        'A soft fail (~all) or permissive (+all/?) policy leaves receivers to decide how to treat unauthorised mail, so forged messages are more likely to be delivered or quarantined rather than rejected.',
      howToReproduce: [
        `Query the TXT records, for example: dig TXT ${ctx.targetUrl.replace('https://', '').replace(/\/$/, '')} +short`,
        'Read the final mechanism of the v=spf1 record: ~all, +all or ?all instead of -all.',
      ],
      howToFix:
        'After confirming every legitimate sender is listed, tighten the policy to end with -all and monitor reports while the change settles.',
      clientExplanation:
        'The domain has an SPF record, but its final rule is soft: mail servers are allowed to let unauthorised senders through. Tightening it to a hard reject is a small change once all legitimate senders are confirmed.',
      evidenceIds: evidenceIds(index, summary, 'TXT'),
      limitations: ['Only the apex domain SPF record was evaluated.'],
    });
  },
};

export const dmarcMissingRule: Rule = {
  id: 'email.dmarc-missing',
  version: VERSION,
  title: 'No DMARC record was found',
  category: 'content-quality',
  severity: 'review',
  standards: ['RFC 7489 — DMARC'],
  evaluate(index, ctx) {
    const summary = summaryOf(index);
    if (summary === null) return null;
    const statuses = dns(summary, 'statuses');
    const dmarcStatus = statuses['DMARC'];
    if (dmarcStatus !== 'OK' && dmarcStatus !== 'NXDOMAIN') return null;
    const dmarc = dns(summary, 'dmarc');
    if (dmarc['present'] !== false) return null;
    const host = ctx.targetUrl.replace('https://', '').replace(/\/$/, '');
    return buildFinding({
      rule: dmarcMissingRule,
      state: 'OBSERVED',
      confidence: 'high',
      summary: `No DMARC record was found at _dmarc.${host}.`,
      whyItMatters:
        'DMARC ties together SPF and DKIM and tells receivers what to do with mail that fails those checks. Without it, a domain has no published policy against impersonation and no aggregate reporting.',
      howToReproduce: [`Query: dig TXT _dmarc.${host} +short`, 'A DMARC record starts with v=DMARC1.'],
      howToFix:
        'Publish a DMARC record at _dmarc.<domain>, starting with p=none to collect reports, then move to quarantine/reject once legitimate mail is aligned.',
      clientExplanation:
        'The domain has no DMARC policy, the standard rule that tells mail providers what to do with messages pretending to come from the business. Starting with a monitoring policy is usually the recommended first step.',
      evidenceIds: evidenceIds(index, summary, 'DMARC'),
      limitations: ['Only the _dmarc TXT record was queried, once, through one resolver.'],
    });
  },
};

export const dmarcPolicyNoneRule: Rule = {
  id: 'email.dmarc-policy-none',
  version: VERSION,
  title: 'The DMARC policy is p=none (monitoring only)',
  category: 'content-quality',
  severity: 'informational',
  standards: ['RFC 7489 — DMARC'],
  evaluate(index, ctx) {
    const summary = summaryOf(index);
    if (summary === null) return null;
    const dmarc = dns(summary, 'dmarc');
    if (dmarc['present'] !== true || dmarc['policy'] !== 'none') return null;
    const host = ctx.targetUrl.replace('https://', '').replace(/\/$/, '');
    return buildFinding({
      rule: dmarcPolicyNoneRule,
      state: 'OBSERVED',
      confidence: 'high',
      summary: `The DMARC record for ${host} exists but its policy is p=none, so failing mail is not quarantined or rejected.`,
      whyItMatters:
        'p=none is a valid starting point for collecting reports, but it does not protect the domain from impersonation until it is tightened to quarantine or reject.',
      howToReproduce: [`Query: dig TXT _dmarc.${host} +short`, 'Look for the p= tag in the v=DMARC1 record.'],
      howToFix:
        'Once aggregate reports show all legitimate senders passing, move the policy to p=quarantine and later p=reject per the rollout guidance.',
      clientExplanation:
        'The domain publishes a DMARC policy, but in monitoring mode only: forged mail is still allowed to arrive. That is typical during rollout; the next step is to tighten the policy when the reports look clean.',
      evidenceIds: evidenceIds(index, summary, 'DMARC'),
      limitations: ['Policy was read from one query; subdomain policies are not inspected.'],
    });
  },
};

export const caaMissingRule: Rule = {
  id: 'dns.caa-missing',
  version: VERSION,
  title: 'No CAA record was found',
  category: 'content-quality',
  severity: 'informational',
  standards: ['RFC 8659 — CAA'],
  evaluate(index, ctx) {
    const summary = summaryOf(index);
    if (summary === null) return null;
    const statuses = dns(summary, 'statuses');
    if (statuses['CAA'] !== 'OK') return null;
    const caa = dns(summary, 'caa');
    if (caa['present'] !== false) return null;
    const host = ctx.targetUrl.replace('https://', '').replace(/\/$/, '');
    return buildFinding({
      rule: caaMissingRule,
      state: 'OBSERVED',
      confidence: 'medium',
      summary: `The domain ${host} publishes no CAA record, so any certificate authority may issue certificates for it.`,
      whyItMatters:
        'CAA records restrict which certificate authorities are allowed to issue certificates for a domain. Their absence is common and low urgency, but adding them is a cheap restriction on mis-issuance.',
      howToReproduce: [`Query: dig CAA ${host} +short`, 'No output means no CAA record is published.'],
      howToFix:
        'Publish a CAA record naming the certificate authority or authorities the domain actually uses, for example: 0 issue "letsencrypt.org".',
      clientExplanation:
        'The domain does not restrict which certificate authorities can issue certificates for it. It is an optional extra lock that most hosts can add in a minute.',
      evidenceIds: evidenceIds(index, summary, 'CAA'),
      limitations: [
        'Absence was observed through one resolver at one point in time; parent-domain CAA records are not evaluated.',
      ],
    });
  },
};

export const emailRules: Rule[] = [spfMissingRule, spfWeakRule, dmarcMissingRule, dmarcPolicyNoneRule, caaMissingRule];
