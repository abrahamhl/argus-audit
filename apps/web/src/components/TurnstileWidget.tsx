import { useEffect, useRef, type ReactNode } from 'react';

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      theme?: 'auto' | 'light' | 'dark';
    },
  ): string;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = 'cf-turnstile-script';

export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
}): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    function render(): void {
      if (cancelled || containerRef.current === null) return;
      if (window.turnstile === undefined) return;
      window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        'error-callback': () => onToken(null),
        'expired-callback': () => onToken(null),
        theme: 'auto',
      });
    }

    if (document.getElementById(SCRIPT_ID) !== null) {
      render();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', render);
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener('load', render);
    };
  }, [siteKey, onToken]);

  return <div className="turnstile" ref={containerRef} aria-label="Human verification" />;
}
