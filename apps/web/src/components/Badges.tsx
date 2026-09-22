import { useState, type ReactNode } from 'react';
import type { Confidence, EvidenceState, Severity } from '@argus-audit/core';
import { STATE_DESCRIPTIONS } from '@argus-audit/core';

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Needs attention',
  review: 'Worth a look',
  informational: 'For information',
};

const STATE_SHORT: Record<EvidenceState, string> = {
  VERIFIED: 'Verified',
  OBSERVED: 'Observed',
  INFERRED: 'Inferred',
  NOT_CHECKED: 'Not checked',
  ERROR: 'Error',
};

export function SeverityChip({ severity }: { severity: Severity }): ReactNode {
  return <span className={`chip chip-${severity}`}>{SEVERITY_LABEL[severity]}</span>;
}

export function StateChip({ state }: { state: EvidenceState }): ReactNode {
  return (
    <span className={`chip chip-state chip-state-${state.toLowerCase()}`} title={STATE_DESCRIPTIONS[state]}>
      {STATE_SHORT[state]}
    </span>
  );
}

export function ConfidenceChip({ confidence }: { confidence: Confidence }): ReactNode {
  return (
    <span className={`chip chip-confidence confidence-${confidence}`} title={`Confidence: ${confidence}`}>
      {confidence} confidence
    </span>
  );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }): ReactNode {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setState('done');
    } catch {
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 1600);
  }

  return (
    <button type="button" className="btn btn-ghost btn-small" onClick={copy}>
      {state === 'done' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
    </button>
  );
}
