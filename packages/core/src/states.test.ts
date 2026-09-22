import { describe, expect, it } from 'vitest';
import { EVIDENCE_STATES, STATE_DESCRIPTIONS, isEvidenceState } from './states';

describe('evidence states contract', () => {
  it('defines exactly the five documented states and never collapses them', () => {
    expect([...EVIDENCE_STATES]).toEqual(['VERIFIED', 'OBSERVED', 'INFERRED', 'NOT_CHECKED', 'ERROR']);
    expect(new Set(EVIDENCE_STATES).size).toBe(EVIDENCE_STATES.length);
  });

  it('has a plain-language description for every state', () => {
    for (const state of EVIDENCE_STATES) {
      expect(STATE_DESCRIPTIONS[state].length).toBeGreaterThan(20);
    }
  });

  it('validates state values', () => {
    expect(isEvidenceState('VERIFIED')).toBe(true);
    expect(isEvidenceState('OBSERVED')).toBe(true);
    expect(isEvidenceState('verified')).toBe(false);
    expect(isEvidenceState('OK')).toBe(false);
    expect(isEvidenceState(undefined)).toBe(false);
  });
});
