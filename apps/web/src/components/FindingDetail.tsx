import type { EvidenceRecord, Finding } from '@argus-audit/core';
import { ConfidenceChip, SeverityChip, StateChip } from './Badges';
import { EvidenceTrace } from './EvidenceTrace';
import type { ReactNode } from 'react';

export function FindingDetail({
  finding,
  evidence,
}: {
  finding: Finding;
  evidence: EvidenceRecord[];
}): ReactNode {
  return (
    <article className="finding-detail" id="finding-detail">
      <header>
        <p className="muted small mono">{finding.findingId}</p>
        <h2>{finding.title}</h2>
        <p className="chips">
          <SeverityChip severity={finding.severity} />
          <StateChip state={finding.state} />
          <ConfidenceChip confidence={finding.confidence} />
        </p>
      </header>

      <EvidenceTrace finding={finding} evidence={evidence} />

      <section>
        <h3>What we observed</h3>
        <p>{finding.summary}</p>
      </section>

      <section>
        <h3>Why it matters</h3>
        <p>{finding.whyItMatters}</p>
      </section>

      <section>
        <h3>How to reproduce</h3>
        <ol>
          {finding.howToReproduce.map((step) => (
            <li key={step} className="mono small">
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3>How to fix</h3>
        <p>{finding.howToFix}</p>
      </section>

      {finding.standards.length > 0 ? (
        <section>
          <h3>Standards / references</h3>
          <ul>
            {finding.standards.map((standard) => (
              <li key={standard}>{standard}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="callout">
        <h3>Client-friendly explanation</h3>
        <p>{finding.clientExplanation}</p>
      </section>

      {finding.limitations.length > 0 ? (
        <section>
          <h3>Limitations of this finding</h3>
          <ul className="muted small">
            {finding.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
