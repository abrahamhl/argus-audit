import type { ReactNode } from 'react';
import { RouteLink, type Route } from '../router';

const NAV: { route: Route; label: string }[] = [
  { route: '/', label: 'Product' },
  { route: '/audit', label: 'Audit' },
  { route: '/lab', label: 'Lab' },
  { route: '/method', label: 'Method' },
  { route: '/architecture', label: 'Architecture' },
];

export function TopBar({
  route,
  onNavigate,
  theme,
  onToggleTheme,
  mode,
}: {
  route: Route;
  onNavigate: (route: Route) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  mode: 'live' | 'fixture' | null;
}): ReactNode {
  return (
    <header className="topbar">
      <RouteLink href="/" onNavigate={onNavigate} className="brand">
        <span className="brand-mark" aria-hidden="true">
          AA
        </span>
        <span>
          <span className="brand-name">ARGUS AUDIT</span>
          <span className="brand-tag">Evidence → Provenance → Finding → Report</span>
        </span>
      </RouteLink>

      <nav className="nav" aria-label="Primary">
        {NAV.map((item) => (
          <RouteLink
            key={item.route}
            href={item.route}
            onNavigate={onNavigate}
            className={`nav-link ${route === item.route ? 'is-active' : ''}`}
            aria-current={route === item.route ? 'page' : undefined}
          >
            {item.label}
          </RouteLink>
        ))}
      </nav>

      <div className="topbar-actions">
        {mode !== null ? (
          <span className={`mode-badge ${mode === 'live' ? 'is-live' : 'is-demo'}`}>
            {mode === 'live' ? 'LIVE' : 'DEMO'}
          </span>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}
