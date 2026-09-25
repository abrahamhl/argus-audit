export interface FixtureError {
  code: string;
  message: string;
}

/** One recorded HTTP exchange (single hop, no redirect following). */
export interface FixtureResponse {
  url: string;
  method?: 'GET' | 'HEAD';
  status: number;
  headers?: Record<string, string>;
  setCookie?: string[];
  body?: string;
  error?: FixtureError;
  recordedAt?: string;
}

import type { FixtureDnsEntry } from '../dns/types';

export interface FixtureBundle {
  id: string;
  name: string;
  /** Demo target, e.g. https://healthy-site.test/ */
  target: string;
  /** When the recording was captured (ISO). Shown as evidence freshness. */
  recordedAt: string;
  notes?: string[];
  /** Recorded DNS answers for the fixture DNS resolver. */
  dns?: FixtureDnsEntry[];
  responses: FixtureResponse[];
}
