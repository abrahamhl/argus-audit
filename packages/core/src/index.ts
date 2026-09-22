export { CORE_VERSION, METHODOLOGY_VERSION, SCANNER_CONTRACT_VERSION, EVIDENCE_CONTRACT_VERSION } from './version';
export {
  EVIDENCE_STATES,
  STATE_DESCRIPTIONS,
  isEvidenceState,
  type EvidenceState,
} from './states';
export {
  EvidenceBuilder,
  type EvidenceRecord,
  type EvidenceKind,
  type JsonValue,
  type NewEvidence,
} from './evidence';
export { provenanceFromExchange, type Provenance } from './evidence-provenance';
export {
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  compareFindings,
  type Finding,
  type Severity,
  type Confidence,
  type FindingCategory,
} from './finding';
export {
  CHECK_IDS,
  DEFAULT_LIMITS,
  type Limits,
  type Scanner,
  type ScanContext,
} from './contracts';
export { AuditError } from './errors';
export {
  normalizeTargetInput,
  isAllowedRedirectUrl,
  checkHostname,
  type NormalizedTarget,
  type TargetResult,
} from './url-guard';

export type { HttpTransport, RawRequest, RawResponse, TransportError } from './transport/types';
export { LiveTransport, type LiveTransportOptions } from './transport/live';
export { FixtureTransport } from './transport/fixture';
export type { FixtureBundle, FixtureResponse } from './transport/fixture-types';
export { HttpClient, MemoTransport, type HttpExchange, type RedirectHop, type HttpClientOptions } from './transport/client';

export { extractPageSignals, findPatternExcerpt, legalClassOf, type PageSignals, type PageLink, type LegalClass } from './util/html';
export { sha256Hex, truncate, stableJson } from './util/hash';
export { systemClock, fixedClock, sleep, type Clock } from './util/clock';
export { TECH_SIGNATURES, CONSENT_SIGNATURES } from './signatures';

export { defaultScanners } from './scanners';
export { reachabilityScanner } from './scanners/reachability';
export { transportSecurityScanner } from './scanners/transport-security';
export { securityHeadersScanner, HEADER_SPECS, FRAME_PROTECTION_HEADER } from './scanners/security-headers';
export { privacyPagesScanner } from './scanners/privacy-pages';
export { brokenLinksScanner, sampleLinks } from './scanners/broken-links';
export { frontendTechScanner } from './scanners/frontend-tech';
export { getHomepageHtml } from './scanners/shared';

export { evaluateRules, allRules, createEvidenceIndex } from './rules';
export type { Rule, RuleContext, EvidenceIndex } from './rules/types';

export {
  REPORT_MODES,
  renderReports,
  computeSummary,
  computeFreshness,
  type AuditSummary,
  type DataFreshness,
  type ReportInput,
  type ReportMode,
} from './report';
export { renderSimpleReport } from './report/simple';
export { renderEngineerReport } from './report/engineer';
export { renderClientReport } from './report/client';

export { templateExplainer, noExplainer, type ExplanationProvider, type ExplanationRequest, type ExplanationResult } from './explain/types';
export { FORBIDDEN_CLAIM_PHRASES, findForbiddenClaim } from './claims';

export { runAudit, type AuditOptions, type AuditResult } from './audit';
