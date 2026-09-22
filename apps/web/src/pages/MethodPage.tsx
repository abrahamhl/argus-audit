import { useEffect, useState, type ReactNode } from 'react';
import { fetchMethodology, type MethodologyInfo } from '../api';
import { SeverityChip } from '../components/Badges';

export function MethodPage(): ReactNode {
  const [methodology, setMethodology] = useState<MethodologyInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMethodology().then((info) => {
      if (cancelled) return;
      if (info === null) setFailed(true);
      else setMethodology(info);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <section className="page">
        <h1>Method</h1>
        <p className="muted">Methodology metadata is not reachable from this deployment right now.</p>
      </section>
    );
  }

  if (methodology === null) {
    return (
      <section className="page">
        <h1>Method</h1>
        <p className="muted" aria-live="polite">
          Loading the methodology from the runtime…
        </p>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Methodology {methodology.methodologyVersion}</p>
        <h1>What is checked, how, and what it cannot prove.</h1>
        <p className="lead">
          This page is generated from the same metadata the runtime uses. A finding is an observation plus a rule
          plus a limitation — never a legal verdict and never an AI opinion.
        </p>
      </div>

      <section className="card">
        <h2>Evidence states</h2>
        <p className="muted small">These states are never collapsed into one another or into a single score.</p>
        <dl className="kv">
          {Object.entries(methodology.states).map(([state, description]) => (
            <div key={state}>
              <dt className="mono">{state}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card">
        <h2>Scanners ({methodology.scanners.length})</h2>
        <ul className="plain-list">
          {methodology.scanners.map((scanner) => (
            <li key={scanner.id}>
              <p className="mono small">
                {scanner.id}@{scanner.version}
              </p>
              <p>{scanner.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Rules ({methodology.rules.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Rule</th>
                <th scope="col">Severity</th>
                <th scope="col">Category</th>
                <th scope="col">Standards</th>
              </tr>
            </thead>
            <tbody>
              {methodology.rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <p className="mono small">{rule.id}</p>
                    <p className="small muted">{rule.title}</p>
                  </td>
                  <td>
                    <SeverityChip severity={rule.severity} />
                  </td>
                  <td className="small">{rule.category}</td>
                  <td className="small muted">{rule.standards.join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Hard limits per audit</h2>
        <dl className="kv">
          {Object.entries(methodology.limits).map(([key, value]) => (
            <div key={key}>
              <dt className="mono small">{key}</dt>
              <dd className="mono">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </section>
  );
}
