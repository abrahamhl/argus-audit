import {
  allRules,
  defaultScanners,
  DEFAULT_LIMITS,
  METHODOLOGY_VERSION,
  STATE_DESCRIPTIONS,
} from '@argus-audit/core';

/**
 * Single source of truth for the /method and /architecture surfaces: the API
 * reports exactly the scanners, rules and states the runtime uses.
 */
export function buildMethodology() {
  return {
    methodologyVersion: METHODOLOGY_VERSION,
    scanners: defaultScanners.map((scanner) => ({
      id: scanner.id,
      version: scanner.version,
      description: scanner.description,
    })),
    rules: allRules.map((rule) => ({
      id: rule.id,
      version: rule.version,
      title: rule.title,
      severity: rule.severity,
      category: rule.category,
      standards: rule.standards,
    })),
    states: STATE_DESCRIPTIONS,
    limits: DEFAULT_LIMITS,
  };
}
