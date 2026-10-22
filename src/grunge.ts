import { noise } from './image-math';

export type GrungeSettings = {
  /** Characteristic patch size in output pixels (30–400). */
  patchSize: number;
  coverage: number;
  distress: number;
  edgeBias: number;
};

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = noise(ix, iy, seed);
  const b = noise(ix + 1, iy, seed);
  const c = noise(ix, iy + 1, seed);
  const d = noise(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a + (a - b - c + d) * u) * v;
}

/**
 * Deterministic ink alpha, not a colored texture. Coverage is an artistic
 * threshold, not an exact area percentage. Coordinates stay in output pixels.
 * A three-pixel scalar grid keeps the expensive warped noise off the pixel loop;
 * local gradients limit antialiasing to a small fringe rather than a soft glow.
 */
export function grungeMask(
  width: number,
  height: number,
  settings: GrungeSettings,
  seed: number,
): Uint8Array {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 0 || height < 0 ||
      !Number.isSafeInteger(width * height) || width * height > 0xffffffff) {
    throw new RangeError('Mask dimensions must be nonnegative integers with a valid typed-array size');
  }
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new RangeError('Seed must be a finite integer');
  }
  const { patchSize, coverage, distress, edgeBias } = settings;
  if (!Number.isFinite(patchSize) || patchSize < 30 || patchSize > 400 ||
      ![coverage, distress, edgeBias].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
    throw new RangeError('Invalid grunge settings');
  }
  const output = new Uint8Array(width * height);
  if (!width || !height || coverage === 0) return output;
  if (coverage === 1 && distress === 0) return output.fill(255);

  const step = 3;
  const columns = Math.ceil((width - 1) / step) + 2;
  const rows = Math.ceil((height - 1) / step) + 2;
  const field = new Float32Array(columns * rows);
  const bias = edgeBias * 0.8 * Math.sin(Math.PI * coverage);
  for (let gy = 0; gy < rows; gy++) {
    const y = gy * step;
    for (let gx = 0; gx < columns; gx++) {
      const x = gx * step;
      const px = x / patchSize;
      const py = y / patchSize;
      const wx = px + (smoothNoise(px * 0.65 + 31, py * 0.65, seed ^ 0x315a) - 0.5) * 1.6;
      const wy = py + (smoothNoise(px * 0.65, py * 0.65 + 73, seed ^ 0x712b) - 0.5) * 1.6;
      const broad = smoothNoise(wx, wy, seed);
      const medium = smoothNoise(wx * 2.3 + 19, wy * 2.3, seed ^ 0x52ac);
      const detail = smoothNoise(wx * 5.7, wy * 5.7 + 41, seed ^ 0x19cb);
      const fine = smoothNoise(wx * 16.1 + 67, wy * 16.1, seed ^ 0x46af);
      // A rectangular radial envelope favors sides and corners without a frame.
      const nx = Math.abs(2 * x / Math.max(1, width - 1) - 1);
      const ny = Math.abs(2 * y / Math.max(1, height - 1) - 1);
      const edge = Math.max(nx, ny);
      field[gy * columns + gx] = broad * 0.44 + medium * 0.28 + detail * 0.18 + fine * 0.1 + bias * (edge * edge - 0.45);
    }
  }

  const threshold = 1 - coverage;
  for (let y = 0; y < height; y++) {
    const gy = Math.floor(y / step);
    const v = (y % step) / step;
    for (let x = 0; x < width; x++) {
      const gx = Math.floor(x / step);
      const u = (x % step) / step;
      const i = gy * columns + gx;
      const a = field[i];
      const b = field[i + 1];
      const c = field[i + columns];
      const d = field[i + columns + 1];
      const value = a + (b - a) * u + (c - a + (a - b - c + d) * u) * v;
      const gradient = (Math.abs((b - a) * (1 - v) + (d - c) * v) +
        Math.abs((c - a) * (1 - u) + (d - b) * u)) / step;
      const fringe = Math.max(0.0001, gradient);
      const grain = noise(x, y, seed ^ 0x6ca1);
      const ragged = (grain - 0.5) * gradient * distress * 3;
      let alpha = coverage === 1 ? 1 : Math.max(0, Math.min(1, 0.5 + (value - threshold + ragged) / fringe));
      if (distress > 0 && alpha > 0) {
        // Sparse pinholes plus clustered small voids; no translucent gray wash.
        const pores = grain * 0.65 + noise(x >> 2, y >> 2, seed ^ 0x3a71) * 0.35;
        if (pores < distress * 0.2) alpha = 0;
      }
      output[y * width + x] = Math.round(alpha * 255);
    }
  }
  return output;
}
