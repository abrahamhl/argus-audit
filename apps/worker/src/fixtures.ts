import type { FixtureBundle } from '@argus-audit/core';
import healthySite from '../../../fixtures/healthy-site/fixture.json';
import missingHeaders from '../../../fixtures/missing-headers/fixture.json';
import messySite from '../../../fixtures/messy-site/fixture.json';

const BUNDLES: FixtureBundle[] = [healthySite, missingHeaders, messySite] as unknown as FixtureBundle[];

export interface FixtureSummary {
  id: string;
  name: string;
  target: string;
  recordedAt: string;
}

export function listFixtures(): FixtureSummary[] {
  return BUNDLES.map((bundle) => ({
    id: bundle.id,
    name: bundle.name,
    target: bundle.target,
    recordedAt: bundle.recordedAt,
  }));
}

export function resolveFixtureBundle(normalizedHttpsUrl: string): FixtureBundle | null {
  let hostname: string;
  try {
    hostname = new URL(normalizedHttpsUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  return BUNDLES.find((bundle) => new URL(bundle.target).hostname.toLowerCase() === hostname) ?? null;
}
