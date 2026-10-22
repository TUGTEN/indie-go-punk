import { describe, expect, it } from 'vitest';
import { enhanceRGBA, type RecoverySettings } from './enhance';

const neutral: RecoverySettings = { exposure: 0, shadows: 0, localContrast: 0, sharpen: 0, denoise: 0 };
const full: RecoverySettings = { exposure: 1, shadows: 100, localContrast: 100, sharpen: 100, denoise: 100 };
const gray = (values: number[]) => Uint8ClampedArray.from(values.flatMap((v) => [v, v, v, 255]));

function run(input: Uint8ClampedArray, width: number, height: number, settings: Partial<RecoverySettings>) {
  return enhanceRGBA(input, width, height, { ...neutral, ...settings });
}

describe('enhanceRGBA', () => {
  it('returns a fresh byte-identical copy at neutral settings', () => {
    const input = Uint8ClampedArray.from({ length: 256 * 4 }, (_, i) => (i * 73) % 256);
    const result = run(input, 16, 16, {});
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    result[0] = 123;
    expect(input[0]).toBe(0);
  });

  it('lifts dark tones much more than highlights and leaves white alone', () => {
    const input = gray([0, 25, 80, 180, 235, 255]);
    const result = run(input, 6, 1, { shadows: 100 });
    const lifts = Array.from({ length: 6 }, (_, i) => result[i * 4] - input[i * 4]);
    expect(lifts[0]).toBeGreaterThan(lifts[1]);
    expect(lifts[1]).toBeGreaterThan(lifts[2]);
    expect(lifts[2]).toBeGreaterThan(lifts[3]);
    expect(lifts[3]).toBeGreaterThanOrEqual(lifts[4]);
    expect(lifts[4]).toBeLessThanOrEqual(1);
    expect(lifts[5]).toBe(0);
  });

  it('responds monotonically to exposure stops in linear light', () => {
    const input = gray([30, 70, 110]);
    const dark = run(input, 3, 1, { exposure: -1 });
    const bright = run(input, 3, 1, { exposure: 1 });
    const brighter = run(input, 3, 1, { exposure: 2 });
    for (let i = 0; i < input.length; i += 4) {
      expect(dark[i]).toBeLessThan(input[i]);
      expect(bright[i]).toBeGreaterThan(input[i]);
      expect(brighter[i]).toBeGreaterThan(bright[i]);
    }
    // sRGB 110 doubled in linear light is about 152, not 220.
    expect(bright[8]).toBeCloseTo(152, 0);
  });

  it('never mutates input, preserves every alpha, and leaves hidden RGB untouched', () => {
    const input = new Uint8ClampedArray([
      255, 0, 170, 0, 30, 50, 60, 1, 40, 60, 70, 127,
      220, 180, 160, 255, 0, 255, 0, 0, 20, 15, 30, 200,
    ]);
    const original = input.slice();
    const result = run(input, 3, 2, full);
    expect(input).toEqual(original);
    for (let i = 0; i < input.length; i += 4) {
      expect(result[i + 3]).toBe(input[i + 3]);
      if (!input[i + 3]) expect(result.slice(i, i + 4)).toEqual(input.slice(i, i + 4));
    }
  });

  it('ignores transparent colors in every neighborhood filter', () => {
    const a = gray([20, 60, 100, 30, 65, 110, 40, 70, 120]);
    a[3] = 0;
    a[19] = 0;
    const b = a.slice();
    b.set([255, 0, 255], 0);
    b.set([0, 255, 0], 16);
    for (const settings of [{ localContrast: 100 }, { denoise: 100 }, { sharpen: 100 }, full]) {
      const first = run(a, 3, 3, settings);
      const second = run(b, 3, 3, settings);
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3]) expect(first.slice(i, i + 4)).toEqual(second.slice(i, i + 4));
      }
    }
  });

  it('keeps flat fields invariant under sharpening and neighborhood corrections', () => {
    for (const [width, height] of [[1, 1], [1, 9], [8, 1], [7, 9]]) {
      const input = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < width * height; i++) input.set([46, 65, 80, (i * 31) % 256], i * 4);
      expect(run(input, width, height, { sharpen: 100 })).toEqual(input);
      expect(run(input, width, height, { localContrast: 100, denoise: 100, sharpen: 100 })).toEqual(input);
    }
  });

  it('sharpens real edges mildly but ignores tiny luma noise', () => {
    const edge = gray([60, 60, 60, 130, 130, 130]);
    const result = run(edge, 6, 1, { sharpen: 100 });
    expect(result[8]).toBeLessThan(edge[8]);
    expect(result[12]).toBeGreaterThan(edge[12]);
    for (let i = 0; i < edge.length; i += 4) expect(Math.abs(result[i] - edge[i])).toBeLessThanOrEqual(7);
    const quiet = gray([60, 61, 60, 61, 60]);
    expect(run(quiet, 5, 1, { sharpen: 100 })).toEqual(quiet);
  });

  it('denoises small variations without smoothing across strong edges', () => {
    const input = gray([60, 60, 66, 60, 60, 180, 180, 180]);
    const result = run(input, 8, 1, { denoise: 100 });
    expect(result[8]).toBeLessThan(66);
    expect(result[16]).toBe(60);
    expect(result[20]).toBe(180);
  });

  it('caps local contrast and does not crush near-black values', () => {
    const input = gray([2, 2, 2, 150, 150, 150]);
    const result = run(input, 6, 1, { localContrast: 100 });
    for (let i = 0; i < input.length; i += 4) {
      expect(Math.abs(result[i] - input[i])).toBeLessThanOrEqual(9);
      expect(result[i]).toBeGreaterThan(0);
    }
  });

  it('produces finite bounded correctly sized output including narrow and empty images', () => {
    for (const [width, height] of [[0, 4], [4, 0], [1, 1], [1, 13], [17, 1], [13, 11]]) {
      const input = Uint8ClampedArray.from({ length: width * height * 4 }, (_, i) => (i * 83) % 256);
      for (const exposure of [-1.5, 0, 2]) {
        const result = run(input, width, height, { ...full, exposure });
        expect(result.length).toBe(width * height * 4);
        for (const value of result) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it('clamps settings to supported ranges and treats nonfinite settings as neutral', () => {
    const input = gray([10, 70, 150]);
    expect(run(input, 3, 1, { exposure: 99, shadows: 999 })).toEqual(run(input, 3, 1, { exposure: 2, shadows: 100 }));
    expect(run(input, 3, 1, { exposure: -99, sharpen: -5 })).toEqual(run(input, 3, 1, { exposure: -1.5 }));
    expect(run(input, 3, 1, { exposure: NaN, shadows: Infinity })).toEqual(input);
  });

  it('rejects mismatched or invalid dimensions', () => {
    for (const [width, height] of [[-1, 1], [1.5, 2], [NaN, 1], [Infinity, 0], [2, 2]]) {
      expect(() => run(gray([50]), width, height, full)).toThrow(RangeError);
    }
  });
});
