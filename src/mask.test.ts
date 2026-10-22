import { describe, expect, it } from 'vitest';
import { refineMask, type MaskSettings } from './mask';

const neutral: MaskSettings = { keepMain: false, trim: 0, feather: 0, cutoff: 0 };
const rgba = (alphas: number[]) => Uint8ClampedArray.from(
  alphas.flatMap((alpha, i) => [i % 256, (i * 17) % 256, 123, alpha]),
);
const alphas = (pixels: Uint8ClampedArray) => Array.from(pixels).filter((_, i) => i % 4 === 3);
function refine(values: number[], width: number, settings: Partial<MaskSettings> = {}) {
  return alphas(refineMask(rgba(values), width, values.length / width, { ...neutral, ...settings }));
}
function rectangle(width: number, height: number, left: number, top: number, right: number, bottom: number): number[] {
  return Array.from({ length: width * height }, (_, i) => {
    const x = i % width;
    const y = Math.floor(i / width);
    return x >= left && x <= right && y >= top && y <= bottom ? 255 : 0;
  });
}

describe('refineMask', () => {
  it('returns an exact independent neutral copy', () => {
    const input = rgba([0, 1, 63, 64, 127, 254, 255, 0]);
    const before = input.slice();
    const output = refineMask(input, 4, 2, neutral);
    expect(output).toEqual(before);
    expect(output).not.toBe(input);
    output[0] = 99;
    expect(input).toEqual(before);
  });

  it('never recolors RGB, even at transparent pixels, or mutates input', () => {
    const input = rgba(rectangle(11, 11, 2, 2, 8, 8));
    const before = input.slice();
    const output = refineMask(input, 11, 11, { keepMain: true, trim: 0.5, feather: 1.5, cutoff: 20 });
    expect(output.length).toBe(input.length);
    expect(input).toEqual(before);
    for (let i = 0; i < input.length; i++) {
      if (i % 4 !== 3) expect(output[i]).toBe(input[i]);
    }
  });

  it('removes specks while retaining a coherent person in original coordinates', () => {
    const values = rectangle(13, 12, 5, 4, 7, 10);
    values[2 * 13 + 6] = 255; // Head, diagonally joined to shoulders.
    values[3 * 13 + 5] = 255;
    values[0] = 255;
    values[11 * 13 + 12] = 100;
    const result = refine(values, 13, { keepMain: true });
    expect(result[0]).toBe(0);
    expect(result[11 * 13 + 12]).toBe(0);
    values.forEach((value, i) => {
      if (value && i !== 0 && i !== 11 * 13 + 12) expect(result[i]).toBe(value);
    });
  });

  it('keeps disconnected components when disabled and connects diagonals when enabled', () => {
    const values = [255, 0, 0, 0, 0, 200, 0, 0, 0, 0, 0, 255];
    expect(refine(values, 4)).toEqual(values);
    expect(refine(values, 4, { keepMain: true })).toEqual([
      255, 0, 0, 0, 0, 200, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('retains a two-pixel soft fringe, but not nearby disconnected high-alpha specks', () => {
    const values = [0, 20, 40, 255, 255, 50, 200, 0, 30];
    expect(refine(values, 9, { keepMain: true })).toEqual([0, 20, 40, 255, 255, 50, 0, 0, 0]);
  });

  it('erodes symmetrically without shifting or cropping the mask', () => {
    const values = rectangle(11, 9, 2, 2, 8, 6);
    expect(refine(values, 11, { trim: 1 })).toEqual(rectangle(11, 9, 3, 3, 7, 5));
    expect(refine(values, 11, { trim: 2 })).toEqual(rectangle(11, 9, 4, 4, 6, 4));
  });

  it('interpolates fractional trim between adjacent integer erosions', () => {
    const values = rectangle(9, 9, 2, 2, 6, 6);
    const zero = refine(values, 9);
    const one = refine(values, 9, { trim: 1 });
    const two = refine(values, 9, { trim: 2 });
    expect(refine(values, 9, { trim: 0.5 })).toEqual(zero.map((v, i) => Math.round((v + one[i]) / 2)));
    expect(refine(values, 9, { trim: 1.25 })).toEqual(one.map((v, i) => Math.round(v * 0.75 + two[i] * 0.25)));
  });

  it('feathers only a small neighborhood, fading edges and preserving interior weight', () => {
    const result = refine(rectangle(11, 11, 3, 3, 7, 7), 11, { feather: 1 });
    expect(result[5 * 11 + 5]).toBe(255);
    expect(result[5 * 11 + 3]).toBe(170);
    expect(result[5 * 11 + 2]).toBe(85);
    expect(result[5 * 11 + 1]).toBe(0);
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(25 * 255, -1);
  });

  it('uses transparent blur bounds and supports fractional feather', () => {
    expect(refine([255], 1, { feather: 1 })).toEqual([28]);
    expect(refine([255], 1, { feather: 0.5 })).toEqual([142]);
    expect(refine([255, 255, 255, 255], 2, { feather: 1 })).toEqual([113, 113, 113, 113]);
  });

  it('smoothly rescales confidence above cutoff and handles its endpoints', () => {
    expect(refine([0, 64, 128, 191, 255], 5, { cutoff: 50 })).toEqual([0, 0, 1, 127, 255]);
    expect(refine([0, 254, 255], 3, { cutoff: 100 })).toEqual([0, 0, 255]);
  });

  it('handles empty, transparent, faint-only, and single-pixel masks', () => {
    expect(refineMask(new Uint8ClampedArray(), 0, 0, { ...neutral, keepMain: true })).toEqual(new Uint8ClampedArray());
    expect(refine([0], 1, { keepMain: true, trim: 4, feather: 3 })).toEqual([0]);
    expect(refine([20, 63], 2, { keepMain: true })).toEqual([0, 0]);
    expect(refine([64], 1, { keepMain: true })).toEqual([64]);
    expect(refine([0, 255, 0], 3, { keepMain: true })).toEqual([0, 255, 0]);
    expect(refine([0, 255, 0], 3, { trim: 1 })).toEqual([0, 0, 0]);
  });

  it('clamps control ranges', () => {
    const values = rectangle(11, 11, 1, 1, 9, 9);
    expect(refine(values, 11, { trim: 99, feather: 99, cutoff: -4 }))
      .toEqual(refine(values, 11, { trim: 4, feather: 3 }));
    expect(refine(values, 11, { trim: -1, feather: -1 })).toEqual(values);
  });
});
