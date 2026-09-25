import { useCallback, useEffect, useState, type ReactNode } from 'react';

export const ROUTES = ['/', '/audit', '/lab', '/method', '/architecture'] as const;
export type Route = (typeof ROUTES)[number];

export function normalizeRoute(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return (ROUTES as readonly string[]).includes(clean) ? (clean as Route) : '/';
}

export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => normalizeRoute(window.location.pathname));

  useEffect(() => {
    const onPopState = (): void => setRoute(normalizeRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: Route) => {
    if (normalizeRoute(window.location.pathname) !== next) {
      window.history.pushState(null, '', next);
    }
    setRoute(next);
    window.scrollTo({ top: 0 });
  }, []);

  return [route, navigate];
}

export interface RouteLinkProps {
  href: string;
  onNavigate: (route: Route) => void;
  onActivate?: () => void;
  children: ReactNode;
  className?: string;
}

/** Real anchors for accessibility and open-in-new-tab, with SPA interception. */
export function RouteLink({ href, onNavigate, onActivate, children, className }: RouteLinkProps): ReactNode {
  const route = normalizeRoute(href);
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        onActivate?.();
        onNavigate(route);
      }}
    >
      {children}
    </a>
  );
}
