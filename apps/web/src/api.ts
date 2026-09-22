import type { AuditResult } from '@argus-audit/core';

export interface FixtureSummary {
  id: string;
  name: string;
  target: string;
  recordedAt: string;
}

export interface HealthInfo {
  mode: 'live' | 'fixture';
  aiExplanations: boolean;
  turnstileSiteKey: string | null;
  methodology: string;
  fixtures: FixtureSummary[];
}

export interface MethodologyInfo {
  methodologyVersion: string;
  scanners: { id: string; version: string; description: string }[];
  rules: {
    id: string;
    version: string;
    title: string;
    severity: 'critical' | 'review' | 'informational';
    category: string;
    standards: string[];
  }[];
  states: Record<string, string>;
  limits: Record<string, number>;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export async function fetchHealth(): Promise<HealthInfo | null> {
  try {
    const response = await fetch('/api/health', { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const body = (await response.json()) as { ok?: boolean } & HealthInfo;
    if (body.ok !== true) return null;
    return body;
  } catch {
    return null;
  }
}

export async function requestAudit(url: string, turnstileToken?: string): Promise<AuditResult> {
  const body: Record<string, string | boolean> = { url, acknowledged: true };
  if (turnstileToken !== undefined && turnstileToken.length > 0) {
    body['turnstileToken'] = turnstileToken;
  }

  const response = await fetch('/api/audit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as
    | ({ ok?: boolean; result?: AuditResult } & ApiErrorBody)
    | null;

  if (!response.ok || payload?.ok !== true || payload.result === undefined) {
    const message = payload?.error?.message ?? `The audit request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return payload.result;
}

export async function fetchLabFixtures(): Promise<FixtureSummary[]> {
  try {
    const response = await fetch('/api/lab/fixtures', { headers: { accept: 'application/json' } });
    if (!response.ok) return [];
    const body = (await response.json()) as { ok?: boolean; fixtures?: FixtureSummary[] };
    return body.ok === true && Array.isArray(body.fixtures) ? body.fixtures : [];
  } catch {
    return [];
  }
}

export async function requestLabAudit(url: string): Promise<AuditResult> {
  const response = await fetch('/api/lab/audit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ url }),
  });
  const payload = (await response.json().catch(() => null)) as
    | ({ ok?: boolean; result?: AuditResult } & ApiErrorBody)
    | null;
  if (!response.ok || payload?.ok !== true || payload.result === undefined) {
    throw new Error(payload?.error?.message ?? `The lab request failed (HTTP ${response.status}).`);
  }
  return payload.result;
}

export async function fetchMethodology(): Promise<MethodologyInfo | null> {
  try {
    const response = await fetch('/api/methodology', { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const body = (await response.json()) as { ok?: boolean } & MethodologyInfo;
    return body.ok === true ? body : null;
  } catch {
    return null;
  }
}
