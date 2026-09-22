import type { Clock } from './util/clock';
import type { EvidenceState } from './states';
import type { Provenance } from './evidence-provenance';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type EvidenceKind =
  | 'http.response'
  | 'tls.indicator'
  | 'header.presence'
  | 'cookie.flags'
  | 'page.presence'
  | 'page.reachability'
  | 'link.status'
  | 'tech.indicator'
  | 'a11y.signal'
  | 'internal';

export interface EvidenceRecord {
  /** Stable within an audit: `${auditId}:${checkId}#${n}`. */
  evidenceId: string;
  auditId: string;
  scannerId: string;
  scannerVersion: string;
  /** Stable check identifier, e.g. `headers.presence.content-security-policy`. */
  checkId: string;
  kind: EvidenceKind;
  state: EvidenceState;
  /** What the evidence is about: a URL, header name, link, etc. */
  subject: string;
  /** Request/observation method, e.g. `GET`, `HEAD`, `html-scan`. */
  method: string;
  observedAt: string;
  data: JsonValue;
  provenance: Provenance;
  limitations: string[];
}

export interface NewEvidence extends Omit<EvidenceRecord, 'evidenceId' | 'auditId' | 'observedAt'> {
  observedAt?: string;
}

/**
 * Deterministic evidence id factory. Sequence numbers are per checkId so ids
 * stay stable as long as scanner execution order is stable (it is: scanners
 * always run in the same order).
 */
export class EvidenceBuilder {
  private readonly sequences = new Map<string, number>();
  readonly records: EvidenceRecord[] = [];

  constructor(
    private readonly auditId: string,
    private readonly clock: Clock,
  ) {}

  add(init: NewEvidence): EvidenceRecord {
    const next = (this.sequences.get(init.checkId) ?? 0) + 1;
    this.sequences.set(init.checkId, next);
    const record: EvidenceRecord = {
      evidenceId: `${this.auditId}:${init.checkId}#${next}`,
      auditId: this.auditId,
      scannerId: init.scannerId,
      scannerVersion: init.scannerVersion,
      checkId: init.checkId,
      kind: init.kind,
      state: init.state,
      subject: init.subject,
      method: init.method,
      observedAt: init.observedAt ?? this.clock.nowIso(),
      data: init.data,
      provenance: init.provenance,
      limitations: init.limitations,
    };
    this.records.push(record);
    return record;
  }
}
