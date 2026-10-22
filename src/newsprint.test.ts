import { describe, expect, it } from 'vitest';
import { newsprintTone } from './print';

describe('newsprint ink screening', () => {
  it('preserves pure black and white at neutral density', () => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      expect(newsprintTone(0, x, y, 1, 50, 31)).toBe(0);
      expect(newsprintTone(1, x, y, 1, 50, 31)).toBe(1);
    }
  });
  it('is deterministic, two-ink, and changes with the seed', () => {
    const sample = (seed: number) => Array.from({ length: 256 }, (_, x) => newsprintTone(0.5, x, 5, 1, 50, seed));
    expect(sample(31)).toEqual(sample(31));
    expect(sample(31)).not.toEqual(sample(32));
    expect(new Set(sample(31))).toEqual(new Set([0, 1]));
  });
  it('grain size controls screening cells, not photographic pixelation', () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      expect(newsprintTone(0.5, x, y, 4, 50, 1))
        .toBe(newsprintTone(0.5, Math.floor(x / 4) * 4, Math.floor(y / 4) * 4, 4, 50, 1));
    }
  });
  it('gamma lifts midtones without losing pure ink and paper endpoints', () => {
    for (let x = 0; x < 1000; x++) {
      expect(newsprintTone(0.3, x, 2, 1, 50, 31, 0.65)).toBeGreaterThanOrEqual(newsprintTone(0.3, x, 2, 1, 50, 31, 1));
      expect(newsprintTone(0, x, 2, 1, 50, 31, 0.65)).toBe(0);
      expect(newsprintTone(1, x, 2, 1, 50, 31, 0.65)).toBe(1);
    }
  });
  it('tracks luminance coverage and adds ink monotonically with density', () => {
    let light = 0;
    for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
      const normal = newsprintTone(0.75, x, y, 1, 50, 31);
      light += normal;
      expect(newsprintTone(0.75, x, y, 1, 80, 31)).toBeLessThanOrEqual(normal);
      expect(newsprintTone(0.75, x, y, 1, 20, 31)).toBeGreaterThanOrEqual(normal);
    }
    expect(light / 10000).toBeGreaterThan(0.72);
    expect(light / 10000).toBeLessThan(0.78);
  });
});
