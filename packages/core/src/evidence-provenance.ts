/**
 * Provenance answers: where did this observation come from, when was the raw
 * data recorded, and how can it be re-obtained.
 */
export interface Provenance {
  /** `live` for a real network observation, `fixture` for recorded demo data. */
  source: 'live' | 'fixture';
  requestedUrl: string;
  finalUrl?: string;
  httpStatus?: number;
  redirectChain?: string[];
  /** Fixture bundle identifier when source is `fixture`. */
  fixtureId?: string;
  /** When the raw response was recorded (fixtures) — not when it was read. */
  recordedAt?: string;
  /** SHA-256 of the captured body (when a body was captured). */
  contentSha256?: string;
  contentBytes?: number;
  contentTruncated?: boolean;
}

export function provenanceFromExchange(exchange: {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  redirects: { url: string; status: number; location: string | null }[];
  source: 'live' | 'fixture';
  fixtureId?: string;
  recordedAt?: string;
  bodySha256?: string;
  bodyBytes?: number;
  bodyTruncated?: boolean;
}): Provenance {
  const provenance: Provenance = {
    source: exchange.source,
    requestedUrl: exchange.requestedUrl,
    finalUrl: exchange.finalUrl,
    httpStatus: exchange.status,
    redirectChain: exchange.redirects.map((hop) => hop.url),
  };
  if (exchange.fixtureId !== undefined) provenance.fixtureId = exchange.fixtureId;
  if (exchange.recordedAt !== undefined) provenance.recordedAt = exchange.recordedAt;
  if (exchange.bodySha256 !== undefined) provenance.contentSha256 = exchange.bodySha256;
  if (exchange.bodyBytes !== undefined) provenance.contentBytes = exchange.bodyBytes;
  if (exchange.bodyTruncated !== undefined) provenance.contentTruncated = exchange.bodyTruncated;
  return provenance;
}
