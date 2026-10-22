import { describe, expect, it } from 'vitest';
import { halftoneCoverage } from './print';

describe('halftoneCoverage', () => {
  it('has white and black endpoints and circular-dot area in highlights', () => {
    expect(halftoneCoverage(0)).toBe(0);
    expect(halftoneCoverage(0.25)).toBeCloseTo(Math.PI / 16);
    expect(halftoneCoverage(0.5)).toBeCloseTo(Math.PI / 4);
    expect(halftoneCoverage(Math.SQRT1_2)).toBe(1);
  });
  it('grows monotonically and continuously across merging dots', () => {
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const value = halftoneCoverage(i / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
    expect(halftoneCoverage(0.500001) - halftoneCoverage(0.499999)).toBeLessThan(0.00001);
  });
  it('produces approximately the requested ink coverage for sampled cells', () => {
    for (const target of [0.1, 0.5, 0.8, 0.95]) {
      let black = 0;
      const side = 100;
      for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
        const distance = Math.hypot((x + 0.5) / side - 0.5, (y + 0.5) / side - 0.5);
        if (halftoneCoverage(distance) < target) black++;
      }
      expect(Math.abs(black / side ** 2 - target)).toBeLessThan(0.01);
    }
  });
});
