import { dilate } from './image-math';

export type MaskSettings = {
  keepMain: boolean;
  trim: number;
  feather: number;
  cutoff: number;
};

const clamp = (value: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0;

/** Keep the largest 8-connected core and its nearby low-confidence fringe. */
function keepLargest(alpha: Uint8Array, width: number, height: number): void {
  const labels = new Int32Array(alpha.length);
  const queue = new Int32Array(alpha.length);
  let label = 0;
  let largest = 0;
  let largestSize = 0;
  for (let start = 0; start < alpha.length; start++) {
    if (alpha[start] < 64 || labels[start]) continue;
    label++;
    let head = 0;
    let tail = 1;
    queue[0] = start;
    labels[start] = label;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
          const neighbor = yy * width + xx;
          if (alpha[neighbor] >= 64 && !labels[neighbor]) {
            labels[neighbor] = label;
            queue[tail++] = neighbor;
          }
        }
      }
    }
    if (tail > largestSize) {
      largest = label;
      largestSize = tail;
    }
  }
  const core = new Uint8Array(alpha.length);
  for (let i = 0; i < alpha.length; i++) {
    if (largest && labels[i] === largest) core[i] = 255;
  }
  const support = dilate(core, width, height, 2);
  for (let i = 0; i < alpha.length; i++) {
    // Dilation preserves soft edges, not separate high-confidence specks.
    if (!core[i] && (alpha[i] >= 64 || !support[i])) alpha[i] = 0;
  }
}

function erode(alpha: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const inverted = Uint8Array.from(alpha, (value) => 255 - value);
  const expanded = dilate(inverted, width, height, radius);
  return expanded.map((value) => 255 - value);
}

/** A normalized small box kernel; out-of-image samples are transparent. */
function blur(alpha: Uint8Array, width: number, height: number, radius: number): Float64Array {
  if (!radius) return Float64Array.from(alpha);
  const result = new Float64Array(alpha.length);
  const weight = (2 * radius + 1) ** 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++) {
          sum += alpha[yy * width + xx];
        }
      }
      result[y * width + x] = sum / weight;
    }
  }
  return result;
}

/** Refine alpha in source-pixel coordinates, leaving every RGB byte untouched. */
export function refineMask(
  input: Uint8ClampedArray,
  width: number,
  height: number,
  settings: MaskSettings,
): Uint8ClampedArray {
  const output = input.slice();
  const trim = clamp(settings.trim, 4);
  const feather = clamp(settings.feather, 3);
  const cutoff = clamp(settings.cutoff, 100);
  if (!width || !height || (!settings.keepMain && !trim && !feather && !cutoff)) return output;

  let alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = input[i * 4 + 3];
  if (settings.keepMain) keepLargest(alpha, width, height);
  // Remove low confidence before morphology so it cannot bleed back into the core.
  if (cutoff) {
    const threshold = cutoff * 255 / 100;
    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = threshold === 255
        ? (alpha[i] === 255 ? 255 : 0)
        : Math.round(Math.max(0, (alpha[i] - threshold) * 255 / (255 - threshold)));
    }
  }
  if (trim) {
    const lower = erode(alpha, width, height, Math.floor(trim));
    const upper = erode(alpha, width, height, Math.ceil(trim));
    const fraction = trim % 1;
    alpha = lower.map((value, i) => Math.round(value + (upper[i] - value) * fraction));
  }
  if (feather) {
    const lower = blur(alpha, width, height, Math.floor(feather));
    const upper = blur(alpha, width, height, Math.ceil(feather));
    const fraction = feather % 1;
    for (let i = 0; i < alpha.length; i++) {
      output[i * 4 + 3] = lower[i] + (upper[i] - lower[i]) * fraction;
    }
  } else {
    for (let i = 0; i < alpha.length; i++) output[i * 4 + 3] = alpha[i];
  }
  return output;
}
