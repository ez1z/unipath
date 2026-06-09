import { describe, it, expect } from 'vitest';
import { computeTuitionBreakdown } from '@/lib/format';
import {
  TMT_PER_USD,
  UNOFFICIAL_TMT_PER_USD,
  TRANSFER_CAP_USD,
  OLD_MANAT_MULTIPLIER,
} from '@/lib/constants';

describe('computeTuitionBreakdown', () => {
  describe('tuition within the transfer cap', () => {
    it('marks exceedsCap as false', () => {
      const result = computeTuitionBreakdown(5000);
      expect(result.exceedsCap).toBe(false);
    });

    it('calculates officialTmt at the fixed rate', () => {
      const result = computeTuitionBreakdown(5000);
      expect(result.officialTmt).toBeCloseTo(5000 * TMT_PER_USD);
    });

    it('sets overageUsd to zero', () => {
      expect(computeTuitionBreakdown(5000).overageUsd).toBe(0);
    });

    it('sets unofficialTmt to zero', () => {
      expect(computeTuitionBreakdown(5000).unofficialTmt).toBe(0);
    });

    it('totalTmt equals officialTmt when within cap', () => {
      const result = computeTuitionBreakdown(5000);
      expect(result.totalTmt).toBeCloseTo(result.officialTmt);
    });
  });

  describe('tuition exactly at the transfer cap', () => {
    it('does not mark exceedsCap', () => {
      expect(computeTuitionBreakdown(TRANSFER_CAP_USD).exceedsCap).toBe(false);
    });

    it('officialTmt covers the full cap amount', () => {
      const result = computeTuitionBreakdown(TRANSFER_CAP_USD);
      expect(result.officialTmt).toBeCloseTo(TRANSFER_CAP_USD * TMT_PER_USD);
    });
  });

  describe('tuition above the transfer cap', () => {
    it('marks exceedsCap as true', () => {
      expect(computeTuitionBreakdown(15000).exceedsCap).toBe(true);
    });

    it('clamps officialTmt to the cap', () => {
      const result = computeTuitionBreakdown(15000);
      expect(result.officialTmt).toBeCloseTo(TRANSFER_CAP_USD * TMT_PER_USD);
    });

    it('calculates overageUsd correctly', () => {
      const result = computeTuitionBreakdown(15000);
      expect(result.overageUsd).toBe(15000 - TRANSFER_CAP_USD);
    });

    it('calculates unofficialTmt at the unofficial rate', () => {
      const result = computeTuitionBreakdown(15000);
      const expectedOverage = (15000 - TRANSFER_CAP_USD) * UNOFFICIAL_TMT_PER_USD;
      expect(result.unofficialTmt).toBeCloseTo(expectedOverage);
    });

    it('totalTmt equals officialTmt + unofficialTmt', () => {
      const result = computeTuitionBreakdown(15000);
      expect(result.totalTmt).toBeCloseTo(result.officialTmt + result.unofficialTmt);
    });
  });

  describe('old manat conversion', () => {
    it('billions is totalTmt * multiplier divided by 1 billion, floored', () => {
      const result = computeTuitionBreakdown(TRANSFER_CAP_USD);
      const oldManat = Math.round(result.totalTmt * OLD_MANAT_MULTIPLIER);
      expect(result.billions).toBe(Math.floor(oldManat / 1_000_000_000));
    });

    it('millions is the millions remainder after billions', () => {
      const result = computeTuitionBreakdown(TRANSFER_CAP_USD);
      const oldManat = Math.round(result.totalTmt * OLD_MANAT_MULTIPLIER);
      expect(result.millions).toBe(Math.floor((oldManat % 1_000_000_000) / 1_000_000));
    });

    it('thousands is the thousands remainder after millions', () => {
      const result = computeTuitionBreakdown(TRANSFER_CAP_USD);
      const oldManat = Math.round(result.totalTmt * OLD_MANAT_MULTIPLIER);
      expect(result.thousands).toBe(Math.floor((oldManat % 1_000_000) / 1_000));
    });
  });

  describe('zero tuition', () => {
    it('returns all zeros', () => {
      const result = computeTuitionBreakdown(0);
      expect(result.exceedsCap).toBe(false);
      expect(result.officialTmt).toBe(0);
      expect(result.overageUsd).toBe(0);
      expect(result.unofficialTmt).toBe(0);
      expect(result.totalTmt).toBe(0);
    });
  });
});
