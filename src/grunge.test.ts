import { describe, expect, it } from 'vitest';
import { grungeMask, type GrungeSettings } from './grunge';

const settings: GrungeSettings = { patchSize: 70, coverage: 0.5, distress: 0.4, edgeBias: 0.8 };
const sum = (mask: Uint8Array): number => mask.reduce((total, value) => total + value, 0);

function regions(mask: Uint8Array, size: number): { edge: number; center: number } {
  let edge = 0;
  let center = 0;
  let edgeCount = 0;
  let centerCount = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.max(Math.abs(2 * x / (size - 1) - 1), Math.abs(2 * y / (size - 1) - 1));
      if (radius > 0.75) { edge += mask[y * size + x]; edgeCount++; }
      if (radius < 0.35) { center += mask[y * size + x]; centerCount++; }
    }
  }
  return { edge: edge / edgeCount, center: center / centerCount };
}

describe('grungeMask', () => {
  it('is repeatable, returns independent buffers, and responds to its seed', () => {
    const first = grungeMask(133, 97, settings, 42);
    const second = grungeMask(133, 97, settings, 42);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first).not.toEqual(grungeMask(133, 97, settings, 43));
    first.fill(0);
    expect(sum(second)).toBeGreaterThan(0);
  });

  it('responds independently to each setting without mutating settings', () => {
    const original = { ...settings };
    const base = grungeMask(240, 240, settings, 17);
    for (const change of [{ patchSize: 160 }, { coverage: 0.7 }, { distress: 1 }, { edgeBias: 0 }]) {
      expect(grungeMask(240, 240, { ...settings, ...change }, 17)).not.toEqual(base);
    }
    expect(settings).toEqual(original);
  });

  it('returns a bounded byte mask for rectangular, tiny, and empty images', () => {
    for (const [width, height] of [[0, 0], [0, 20], [20, 0], [1, 1], [1, 31], [29, 1], [101, 83]]) {
      const mask = grungeMask(width, height, settings, -123);
      expect(mask).toBeInstanceOf(Uint8Array);
      expect(mask.length).toBe(width * height);
      expect(mask.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)).toBe(true);
    }
  });

  it('rejects invalid dimensions, settings, and seeds even for empty masks', () => {
    for (const value of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => grungeMask(value, 10, settings, 1)).toThrow(RangeError);
      expect(() => grungeMask(10, value, settings, 1)).toThrow(RangeError);
    }
    expect(() => grungeMask(65536, 65536, settings, 1)).toThrow(RangeError);
    for (const patchSize of [29, 401, NaN, Infinity]) {
      expect(() => grungeMask(0, 0, { ...settings, patchSize }, 1)).toThrow(RangeError);
    }
    for (const key of ['coverage', 'distress', 'edgeBias'] as const) {
      for (const value of [-0.1, 1.1, NaN, Infinity]) {
        expect(() => grungeMask(0, 0, { ...settings, [key]: value }, 1)).toThrow(RangeError);
      }
    }
    for (const seed of [NaN, Infinity, -Infinity, 0.5]) {
      expect(() => grungeMask(0, 0, settings, seed)).toThrow(RangeError);
    }
  });

  it('has exact empty/full endpoints, with distress removing ink from full coverage', () => {
    for (const edgeBias of [0, 0.8, 1]) {
      expect(sum(grungeMask(160, 120, { ...settings, coverage: 0, edgeBias }, 91))).toBe(0);
      const full = grungeMask(160, 120, { ...settings, coverage: 1, distress: 0, edgeBias }, 91);
      expect(full.every((value) => value === 255)).toBe(true);
      const distressed = grungeMask(160, 120, { ...settings, coverage: 1, distress: 1, edgeBias }, 91);
      expect(sum(distressed)).toBeLessThan(sum(full));
      expect(sum(distressed)).toBeGreaterThan(sum(full) * 0.8);
    }
  });

  it('increases total ink with coverage across deterministic probes', () => {
    const totals = [0.2, 0.5, 0.8].map((coverage) =>
      [3, 19, 81, 204].reduce((total, seed) => total + sum(grungeMask(180, 180, { ...settings, coverage }, seed)), 0));
    expect(totals[1]).toBeGreaterThan(totals[0]);
    expect(totals[2]).toBeGreaterThan(totals[1]);
  });

  it('moves ink toward edges and away from the center over multiple seeds', () => {
    for (const edgeBias of [0.8, 1]) {
      let biasedEdge = 0;
      let biasedCenter = 0;
      let uniformEdge = 0;
      let uniformCenter = 0;
      for (const seed of [7, 31, 97, 251, 1023, 8181]) {
        const biased = regions(grungeMask(240, 240, { ...settings, edgeBias }, seed), 240);
        const uniform = regions(grungeMask(240, 240, { ...settings, edgeBias: 0 }, seed), 240);
        biasedEdge += biased.edge;
        biasedCenter += biased.center;
        uniformEdge += uniform.edge;
        uniformCenter += uniform.center;
      }
      expect(biasedEdge).toBeGreaterThan(biasedCenter);
      expect(biasedEdge).toBeGreaterThan(uniformEdge);
      expect(biasedCenter).toBeLessThan(uniformCenter);
    }
  });

  it('makes coherent opaque splotches, with only a narrow antialiased perimeter', () => {
    const mask = grungeMask(320, 320, { ...settings, distress: 0, edgeBias: 0 }, 412);
    let partial = 0;
    let differences = 0;
    for (let y = 0; y < 320; y++) {
      for (let x = 0; x < 319; x++) {
        const value = mask[y * 320 + x];
        if (value > 0 && value < 255) partial++;
        differences += Math.abs(value - mask[y * 320 + x + 1]);
      }
    }
    expect(mask.includes(0)).toBe(true);
    expect(mask.includes(255)).toBe(true);
    expect(partial).toBeGreaterThan(0);
    expect(partial / mask.length).toBeLessThan(0.08);
    expect(differences / mask.length).toBeLessThan(12);
  });
});
