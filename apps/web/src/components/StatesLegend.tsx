import type { ReactNode } from 'react';
import { EVIDENCE_STATES, STATE_DESCRIPTIONS } from '@argus-audit/core';
import { StateChip } from './Badges';

export function StatesLegend(): ReactNode {
  return (
    <details className="legend">
      <summary>What do the evidence labels mean?</summary>
      <dl>
        {EVIDENCE_STATES.map((state) => (
          <div key={state} className="legend-row">
            <dt>
              <StateChip state={state} />
            </dt>
            <dd>{STATE_DESCRIPTIONS[state]}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">
        These states are never merged into a single score. A finding can be a confident observation while an
        interpretation stays low-confidence, and both are shown as such.
      </p>
    </details>
  );
}
