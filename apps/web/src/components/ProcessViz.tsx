import type { ReactNode } from 'react';
import type { AuditResult } from '@argus-audit/core';

export type PipelinePhase = 'idle' | 'running' | 'done' | 'error';

interface Stage {
  id: string;
  label: string;
  description: string;
  future?: boolean;
}

const STAGES: Stage[] = [
  {
    id: 'target',
    label: 'TARGET',
    description: 'Validate the address and the scope boundary before any request.',
  },
  {
    id: 'observe',
    label: 'OBSERVE',
    description: 'Passive public-surface requests: reachability, transport, headers, pages, links, technology.',
  },
  {
    id: 'prove',
    label: 'PROVE',
    description: 'Every observation becomes an immutable evidence record with provenance and a canonical hash.',
  },
  {
    id: 'decide',
    label: 'DECIDE',
    description: 'Pure deterministic rules turn evidence into findings with states and confidence.',
  },
  {
    id: 'report',
    label: 'REPORT',
    description: 'The same findings rendered for three audiences.',
  },
  {
    id: 'fix',
    label: 'FIX',
    description: 'Remediation workflow.',
    future: true,
  },
  {
    id: 'verify',
    label: 'VERIFY',
    description: 'Retest proof before/after.',
    future: true,
  },
];

/**
 * Truthful pipeline visualization. With a result it shows REAL aggregated
 * numbers from the completed audit. While running it states explicitly that
 * live per-stage telemetry does not exist yet — no fake progress animation.
 */
export function ProcessViz({ phase, result }: { phase: PipelinePhase; result: AuditResult | null }): ReactNode {
  const status = (stageId: (typeof STAGES)[number]['id'], future: boolean | undefined): ReactNode => {
    if (future === true) return <span className="stage-status is-future">not implemented</span>;
    if (result === null) {
      if (phase === 'running') return <span className="stage-status is-pending">waiting</span>;
      if (phase === 'error') return <span className="stage-status is-error">stopped</span>;
      return <span className="stage-status">not started</span>;
    }
    const evidence = result.evidence;
    const states = result.summary.evidenceStates;
    switch (stageId) {
      case 'target':
        return <span className="stage-status is-ok">scope ok</span>;
      case 'observe': {
        const parts = [
          `${evidence.length} records`,
          states.OBSERVED > 0 ? `observed ×${states.OBSERVED}` : null,
          states.INFERRED > 0 ? `inferred ×${states.INFERRED}` : null,
          states.ERROR > 0 ? `error ×${states.ERROR}` : null,
          states.NOT_CHECKED > 0 ? `not checked ×${states.NOT_CHECKED}` : null,
        ].filter((part): part is string => part !== null);
        return <span className="stage-status is-ok">{parts.join(' · ')}</span>;
      }
      case 'prove': {
        const hashed = evidence.filter((record) => record.provenance.contentSha256 !== undefined).length;
        return (
          <span className="stage-status is-ok">
            hash {result.evidenceHash.slice(0, 12)}… · {hashed} body hashes
          </span>
        );
      }
      case 'decide':
        return (
          <span className="stage-status is-ok">
            {result.summary.counts.total} findings ({result.summary.counts.critical} attention ·{' '}
            {result.summary.counts.review} review · {result.summary.counts.informational} info)
          </span>
        );
      case 'report':
        return <span className="stage-status is-ok">simple · engineer · client ready</span>;
      default:
        return null;
    }
  };

  return (
    <section className="pipeline" aria-label="Audit pipeline">
      <div className="pipeline-head">
        <h2>Pipeline</h2>
        {phase === 'running' ? (
          <p className="muted small">
            Process visualization — this version has no live per-stage telemetry; results appear when the audit
            completes.
          </p>
        ) : (
          <p className="muted small">
            TARGET → OBSERVE → PROVE → DECIDE → REPORT. FIX and VERIFY are not implemented.
          </p>
        )}
      </div>
      <ol className="stage-rail">
        {STAGES.map((stage) => (
          <li
            key={stage.id}
            className={`stage ${stage.future === true ? 'is-future' : ''} ${
              phase === 'running' && stage.future !== true ? 'is-waiting' : ''
            }`}
          >
            <span className="stage-label">{stage.label}</span>
            <span className="stage-description">{stage.description}</span>
            {status(stage.id, stage.future)}
          </li>
        ))}
      </ol>
    </section>
  );
}
