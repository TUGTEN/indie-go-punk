export type RecoverySettings = {
  exposure: number;
  shadows: number;
  localContrast: number;
  sharpen: number;
  denoise: number;
};

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const setting = (value: number, low: number, high: number) =>
  Number.isFinite(value) ? clamp(value, low, high) : 0;
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const linear = (v: number) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const srgb = (v: number) => v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;

/** Truncated box kernel, normalized by coverage, not pixel count. O(width * height). */
function weightedBlur(
  values: Float64Array, alpha: Float64Array, width: number, height: number, radius: number,
): Float64Array {
  const horizontal = new Float64Array(values.length);
  const coverage = new Float64Array(values.length);
  const result = new Float64Array(values.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    let weight = 0;
    for (let x = 0; x <= Math.min(radius, width - 1); x++) {
      sum += values[row + x] * alpha[row + x];
      weight += alpha[row + x];
    }
    for (let x = 0; x < width; x++) {
      horizontal[row + x] = sum;
      coverage[row + x] = weight;
      const leaving = x - radius;
      const entering = x + radius + 1;
      if (leaving >= 0) {
        sum -= values[row + leaving] * alpha[row + leaving];
        weight -= alpha[row + leaving];
      }
      if (entering < width) {
        sum += values[row + entering] * alpha[row + entering];
        weight += alpha[row + entering];
      }
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    let weight = 0;
    for (let y = 0; y <= Math.min(radius, height - 1); y++) {
      sum += horizontal[y * width + x];
      weight += coverage[y * width + x];
    }
    for (let y = 0; y < height; y++) {
      const i = y * width + x;
      result[i] = weight > 1e-12 ? sum / weight : values[i];
      const leaving = y - radius;
      const entering = y + radius + 1;
      if (leaving >= 0) {
        sum -= horizontal[leaving * width + x];
        weight -= coverage[leaving * width + x];
      }
      if (entering < height) {
        sum += horizontal[entering * width + x];
        weight += coverage[entering * width + x];
      }
    }
  }
  return result;
}

/** Non-generative portrait recovery. RGB is straight (unpremultiplied) sRGB. */
export function enhanceRGBA(
  input: Uint8ClampedArray, width: number, height: number, settings: RecoverySettings,
): Uint8ClampedArray {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 0 || height < 0
    || !Number.isSafeInteger(width * height * 4) || input.length !== width * height * 4) {
    throw new RangeError('RGBA length must match nonnegative integer dimensions');
  }
  const output = input.slice();
  const exposure = setting(settings.exposure, -1.5, 2);
  const shadows = setting(settings.shadows, 0, 100) / 100;
  const contrast = setting(settings.localContrast, 0, 100) / 100;
  const sharpen = setting(settings.sharpen, 0, 100) / 100;
  const denoise = setting(settings.denoise, 0, 100) / 100;
  const count = width * height;
  if (!count || !(exposure || shadows || contrast || sharpen || denoise)) return output;

  const rgb = new Float64Array(count * 3);
  const alpha = new Float64Array(count);
  const base = new Float64Array(count);
  const gain = 2 ** exposure;
  for (let i = 0; i < count; i++) {
    alpha[i] = input[i * 4 + 3] / 255;
    if (!alpha[i]) continue;
    let r = input[i * 4] / 255;
    let g = input[i * 4 + 1] / 255;
    let b = input[i * 4 + 2] / 255;
    if (exposure) {
      r = srgb(Math.min(1, linear(r) * gain));
      g = srgb(Math.min(1, linear(g) * gain));
      b = srgb(Math.min(1, linear(b) * gain));
    }
    const y = luma(r, g, b);
    // Smooth lift strongest in shadows; asymptotically protects white.
    // Blending toward white avoids clipping individual channels or inventing color.
    const lift = shadows * 0.22 * (1 - y) ** 3;
    r += (1 - r) * lift;
    g += (1 - g) * lift;
    b += (1 - b) * lift;
    rgb.set([r, g, b], i * 3);
    base[i] = luma(r, g, b);
  }

  let detail = base.slice();
  if (contrast) {
    const radius = Math.max(3, Math.round(Math.min(width, height) * 0.06));
    const broad = weightedBlur(base, alpha, width, height, radius);
    for (let i = 0; i < count; i++) {
      // Cap halos and taper away from both ends to avoid crushed blacks.
      const protection = 4 * base[i] * (1 - base[i]);
      detail[i] += clamp((base[i] - broad[i]) * 0.3, -0.035, 0.035) * contrast * protection;
    }
  }
  if (denoise) {
    const smooth = detail.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!alpha[i]) continue;
        let sum = 0;
        let weight = 0;
        for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
          for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
            const j = yy * width + xx;
            const w = alpha[j] * Math.max(0, 1 - Math.abs(detail[j] - detail[i]) / 0.06) ** 2;
            sum += detail[j] * w;
            weight += w;
          }
        }
        if (weight) smooth[i] += (sum / weight - detail[i]) * denoise * 0.5;
      }
    }
    detail = smooth;
  }
  if (sharpen) {
    const smooth = weightedBlur(detail, alpha, width, height, 1);
    for (let i = 0; i < count; i++) {
      const residual = detail[i] - smooth[i];
      // Soft noise threshold, conservative gain and a hard halo ceiling.
      const edge = Math.sign(residual) * Math.max(0, Math.abs(residual) - 2 / 255);
      detail[i] += clamp(edge * sharpen * 0.35, -0.025, 0.025)
        * (4 * detail[i] * (1 - detail[i]));
    }
  }
  for (let i = 0; i < count; i++) {
    if (!alpha[i]) continue;
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    // Equal-channel detail adjustment changes luminance only; limit to gamut.
    const delta = clamp(detail[i] - base[i], -Math.min(r, g, b), 1 - Math.max(r, g, b));
    output[i * 4] = (r + delta) * 255;
    output[i * 4 + 1] = (g + delta) * 255;
    output[i * 4 + 2] = (b + delta) * 255;
  }
  return output;
}
