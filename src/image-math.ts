export type Bounds = { x: number; y: number; width: number; height: number };

/** Bounds include every pixel whose alpha is at least the threshold. */
export function alphaBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 16,
): Bounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] >= threshold) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return right < 0
    ? null
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** Square max dilation with clipped edges, in O(width * height) time. */
export function dilate(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  const output = new Uint8Array(width * height);
  if (width === 0 || height === 0) return output;
  const r = Math.max(0, Math.floor(radius));
  const horizontal = new Uint8Array(width * height);
  const deque = new Int32Array(Math.max(width, height));

  // A monotone deque visits each sample at most twice per separable pass.
  function maxLine(
    source: Uint8Array,
    target: Uint8Array,
    start: number,
    stride: number,
    length: number,
  ): void {
    let head = 0;
    let tail = 0;
    let next = 0;
    for (let i = 0; i < length; i++) {
      const end = Math.min(length - 1, i + r);
      while (next <= end) {
        const value = source[start + next * stride];
        while (tail > head && source[start + deque[tail - 1] * stride] <= value) {
          tail--;
        }
        deque[tail++] = next++;
      }
      while (head < tail && deque[head] < i - r) head++;
      target[start + i * stride] = source[start + deque[head] * stride];
    }
  }

  for (let y = 0; y < height; y++) maxLine(mask, horizontal, y * width, 1, width);
  for (let x = 0; x < width; x++) maxLine(horizontal, output, x, width, height);
  return output;
}

/** Stateless hash of integer pixel coordinates and a seed, mapped to [0, 1). */
export function noise(x: number, y: number, seed: number): number {
  let hash = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(y | 0, 0x5f356495) ^ (seed | 0);
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0x100000000;
}

const BAYER_8 = [
  0, 48, 12, 60, 3, 51, 15, 63,
  32, 16, 44, 28, 35, 19, 47, 31,
  8, 56, 4, 52, 11, 59, 7, 55,
  40, 24, 36, 20, 43, 27, 39, 23,
  2, 50, 14, 62, 1, 49, 13, 61,
  34, 18, 46, 30, 33, 17, 45, 29,
  10, 58, 6, 54, 9, 57, 5, 53,
  42, 26, 38, 22, 41, 25, 37, 21,
];

/** Standard 8x8 Bayer thresholds; bit masks wrap negative integer coordinates. */
export function bayer8(x: number, y: number): number {
  return BAYER_8[(y & 7) * 8 + (x & 7)] / 64;
}
