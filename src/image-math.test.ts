import { describe, expect, it } from 'vitest';
import { alphaBounds, bayer8, dilate, noise, type Bounds } from './image-math';

function rgba(alphas: number[]): Uint8ClampedArray {
  return Uint8ClampedArray.from(alphas.flatMap((alpha) => [255, 255, 255, alpha]));
}

function bruteDilation(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const output = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++) {
          output[y * width + x] = Math.max(output[y * width + x], mask[yy * width + xx]);
        }
      }
    }
  }
  return output;
}

describe('alphaBounds', () => {
  it('returns null for empty and transparent images, ignoring RGB', () => {
    expect(alphaBounds(new Uint8ClampedArray(), 0, 0)).toBeNull();
    expect(alphaBounds(new Uint8ClampedArray(), 0, 5)).toBeNull();
    expect(alphaBounds(rgba([0, 0, 0, 0]), 2, 2)).toBeNull();
  });

  it('includes the entire full image and a single edge pixel', () => {
    const full: Bounds = { x: 0, y: 0, width: 3, height: 2 };
    expect(alphaBounds(rgba([255, 255, 255, 255, 255, 255]), 3, 2)).toEqual(full);
    expect(alphaBounds(rgba([0, 0, 0, 0, 0, 255]), 3, 2)).toEqual({
      x: 2, y: 1, width: 1, height: 1,
    });
  });

  it('computes inclusive non-origin bounds and ignores faint specks', () => {
    const pixels = rgba([
      15, 0, 0, 0, 0,
      0, 16, 0, 0, 0,
      0, 0, 0, 255, 0,
      0, 0, 0, 0, 1,
    ]);
    const original = pixels.slice();
    expect(alphaBounds(pixels, 5, 4)).toEqual({ x: 1, y: 1, width: 3, height: 2 });
    expect(alphaBounds(pixels, 5, 4, 15)).toEqual({ x: 0, y: 0, width: 4, height: 3 });
    expect(alphaBounds(pixels, 5, 4, 255)).toEqual({ x: 3, y: 2, width: 1, height: 1 });
    expect(alphaBounds(pixels, 5, 4, 256)).toBeNull();
    expect(alphaBounds(pixels, 5, 4, 0)).toEqual({ x: 0, y: 0, width: 5, height: 4 });
    expect(pixels).toEqual(original);
  });
});

describe('dilate', () => {
  it('returns a fresh copy for radius zero, without mutating its input', () => {
    const mask = new Uint8Array([0, 20, 255, 4]);
    const result = dilate(mask, 2, 2, 0);
    expect(result).toEqual(mask);
    expect(result).not.toBe(mask);
    result[0] = 99;
    expect(mask[0]).toBe(0);
  });

  it('handles empty and full masks', () => {
    expect(dilate(new Uint8Array(), 0, 3, 2)).toEqual(new Uint8Array());
    expect(dilate(new Uint8Array(), 3, 0, 2)).toEqual(new Uint8Array());
    expect(dilate(new Uint8Array(12), 4, 3, 100)).toEqual(new Uint8Array(12));
    expect(dilate(new Uint8Array(12).fill(255), 4, 3, 2)).toEqual(new Uint8Array(12).fill(255));
  });

  it('includes diagonal neighbors and clips at edges without wrapping rows', () => {
    expect(dilate(new Uint8Array([255, 0, 0, 0, 0, 0, 0, 0, 0]), 3, 3, 1))
      .toEqual(new Uint8Array([255, 255, 0, 255, 255, 0, 0, 0, 0]));
  });

  it('matches brute-force max dilation across sizes, radii, and nonbinary masks', () => {
    for (const [width, height] of [[1, 1], [1, 8], [9, 1], [3, 7], [8, 5]]) {
      for (const radius of [0, 1, 2, 5, 20]) {
        for (let seed = 0; seed < 8; seed++) {
          const mask = Uint8Array.from({ length: width * height }, (_, i) =>
            Math.floor(noise(i, seed, 123) * 256));
          const original = mask.slice();
          expect(dilate(mask, width, height, radius)).toEqual(bruteDilation(mask, width, height, radius));
          expect(mask).toEqual(original);
        }
      }
    }
  });
});

describe('noise', () => {
  it('has stable known values', () => {
    expect(noise(0, 0, 0)).toBe(0);
    expect(noise(1, 2, 3)).toBe(0.537409414537251);
    expect(noise(-13, 57, 42)).toBe(0.06630366272293031);
    expect(noise(2147483647, -2147483648, -1)).toBe(0.21742489095777273);
  });

  it('is deterministic, bounded, and sensitive to both coordinates and seed', () => {
    const samples = new Set<number>();
    for (let y = -10; y < 10; y++) {
      for (let x = -10; x < 10; x++) {
        const value = noise(x, y, 42);
        expect(value).toBe(noise(x, y, 42));
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
        samples.add(value);
      }
    }
    expect(samples.size).toBeGreaterThan(300);
    expect(noise(1, 2, 3)).not.toBe(noise(2, 1, 3));
    expect(noise(1, 2, 3)).not.toBe(noise(1, 2, 4));
  });
});

describe('bayer8', () => {
  it('contains every threshold from 0/64 to 63/64 exactly once', () => {
    const values = Array.from({ length: 64 }, (_, i) => bayer8(i % 8, Math.floor(i / 8)));
    expect([...values].sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i / 64));
    expect(values.slice(0, 8)).toEqual([0, 48, 12, 60, 3, 51, 15, 63].map((v) => v / 64));
    expect(bayer8(7, 7)).toBe(21 / 64);
  });

  it('tiles in both directions, including negative coordinates', () => {
    for (let y = -24; y <= 24; y++) {
      for (let x = -24; x <= 24; x++) {
        expect(bayer8(x, y)).toBe(bayer8(((x % 8) + 8) % 8, ((y % 8) + 8) % 8));
        expect(bayer8(x, y)).toBe(bayer8(x + 8, y - 8));
      }
    }
    expect(bayer8(-1, -1)).toBe(21 / 64);
  });
});
