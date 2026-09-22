import type { EvidenceRecord, JsonValue } from '../evidence';
import type { Confidence, Finding, FindingCategory, Severity } from '../finding';
import type { EvidenceState } from '../states';

export interface EvidenceIndex {
  all: EvidenceRecord[];
  first(checkId: string): EvidenceRecord | undefined;
  allOf(checkId: string): EvidenceRecord[];
}

export function createEvidenceIndex(evidence: EvidenceRecord[]): EvidenceIndex {
  const byCheck = new Map<string, EvidenceRecord[]>();
  for (const record of evidence) {
    const bucket = byCheck.get(record.checkId);
    if (bucket === undefined) {
      byCheck.set(record.checkId, [record]);
    } else {
      bucket.push(record);
    }
  }
  return {
    all: evidence,
    first: (checkId) => byCheck.get(checkId)?.[0],
    allOf: (checkId) => byCheck.get(checkId) ?? [],
  };
}

export interface RuleContext {
  generatedAt: string;
  methodologyVersion: string;
  targetUrl: string;
}

export interface Rule {
  id: string;
  version: string;
  title: string;
  category: FindingCategory;
  severity: Severity;
  standards: string[];
  evaluate(index: EvidenceIndex, ctx: RuleContext): Finding | null;
}

export function dataOf(record: EvidenceRecord): Record<string, JsonValue> {
  if (record.data !== null && typeof record.data === 'object' && !Array.isArray(record.data)) {
    return record.data as Record<string, JsonValue>;
  }
  return {};
}

export function boolOf(record: EvidenceRecord, key: string): boolean | null {
  const value = dataOf(record)[key];
  return typeof value === 'boolean' ? value : null;
}

export function numOf(record: EvidenceRecord, key: string): number | null {
  const value = dataOf(record)[key];
  return typeof value === 'number' ? value : null;
}

export function strOf(record: EvidenceRecord, key: string): string | null {
  const value = dataOf(record)[key];
  return typeof value === 'string' ? value : null;
}

export function arrOf(record: EvidenceRecord, key: string): JsonValue[] {
  const value = dataOf(record)[key];
  return Array.isArray(value) ? value : [];
}

export interface FindingInput {
  rule: Rule;
  state: EvidenceState;
  confidence: Confidence;
  summary: string;
  whyItMatters: string;
  howToReproduce: string[];
  howToFix: string;
  clientExplanation: string;
  evidenceIds: string[];
  severity?: Severity;
  title?: string;
  limitations?: string[];
}

export function buildFinding(input: FindingInput): Finding {
  if (input.evidenceIds.length === 0) {
    throw new Error(`Rule ${input.rule.id} produced a finding without evidence references`);
  }
  return {
    findingId: input.rule.id,
    ruleId: input.rule.id,
    ruleVersion: input.rule.version,
    title: input.title ?? input.rule.title,
    severity: input.severity ?? input.rule.severity,
    category: input.rule.category,
    state: input.state,
    confidence: input.confidence,
    summary: input.summary,
    whyItMatters: input.whyItMatters,
    howToReproduce: input.howToReproduce,
    howToFix: input.howToFix,
    clientExplanation: input.clientExplanation,
    evidenceIds: input.evidenceIds,
    standards: input.rule.standards,
    limitations: input.limitations ?? [],
  };
}
