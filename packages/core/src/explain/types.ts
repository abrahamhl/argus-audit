import type { EvidenceRecord } from '../evidence';
import type { Finding } from '../finding';

export interface ExplanationRequest {
  finding: Finding;
  evidence: EvidenceRecord[];
}

export interface ExplanationResult {
  /** Replacement text for the client-friendly explanation only. */
  clientExplanation?: string;
}

/**
 * Optional explanation layer. AI is never the source of truth: it may only
 * rephrase what the deterministic report already states, and any failure or
 * missing provider falls back to the deterministic text.
 */
export interface ExplanationProvider {
  id: string;
  enabled: boolean;
  explain(request: ExplanationRequest): Promise<ExplanationResult | null>;
}

/** Default provider: deterministic templates only. */
export const templateExplainer: ExplanationProvider = {
  id: 'template',
  enabled: true,
  async explain() {
    return null;
  },
};

export const noExplainer: ExplanationProvider = {
  id: 'none',
  enabled: false,
  async explain() {
    return null;
  },
};
