export interface RawRequest {
  url: string;
  method: 'GET' | 'HEAD';
}

export interface TransportError {
  code: string;
  message: string;
}

export interface RawResponse {
  requestedUrl: string;
  method: 'GET' | 'HEAD';
  status: number;
  headers: Record<string, string>;
  /** Raw Set-Cookie header values. Values are never stored in evidence. */
  setCookie?: string[];
  bodyText?: string;
  bodyBytes?: number;
  bodyTruncated?: boolean;
  bodySha256?: string;
  error?: TransportError;
  durationMs: number;
  source: 'live' | 'fixture';
  fixtureId?: string;
  recordedAt?: string;
}

/** Lowest-level contract: performs one request, one hop, no redirect logic. */
export interface HttpTransport {
  fetch(request: RawRequest): Promise<RawResponse>;
}
