import { alphaBounds, bayer8, dilate, noise, type Bounds } from './image-math';
import type { Settings } from './settings';
import { halftoneCoverage, newsprintTone } from './print';
import { refineMask } from './mask';
import { enhanceRGBA } from './enhance';
import { grungeMask } from './grunge';

export const OUTPUT_WIDTH = 1080;
export type Format = 'Square' | 'Landscape' | 'Portrait';
export const outputSize = (format: Format): [number, number] =>
  format === 'Landscape' ? [1280, 720] : format === 'Portrait' ? [1080, 1350] : [1080, 1080];

function canvas(width: number, height: number) {
  const result = document.createElement('canvas');
  result.width = width;
  result.height = height;
  return result;
}
function context(surface: HTMLCanvasElement) {
  const ctx = surface.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser does not support Canvas 2D.');
  return ctx;
}
function rgb(color: string): number[] {
  // DialKit accepts more than hex; let the browser normalize CSS colors.
  const surface = canvas(1, 1);
  const ctx = context(surface);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
}

export function readableInk(color: string) {
  const [r, g, b] = rgb(color);
  return r * 0.2126 + g * 0.7152 + b * 0.0722 > 155 ? '#263225' : '#eee9d4';
}
const clamp = (value: number) => Math.max(0, Math.min(255, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const fract = (value: number) => value - Math.floor(value);

function smoothNoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = fract(x), fy = fract(y);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return mix(mix(noise(ix, iy, seed), noise(ix + 1, iy, seed), sx),
    mix(noise(ix, iy + 1, seed), noise(ix + 1, iy + 1, seed), sx), sy);
}

function background(width: number, height: number, settings: Settings['background'], seed: number) {
  const surface = canvas(width, height);
  if (settings.transparent) return surface;
  const ctx = context(surface);
  const base = rgb(settings.color);
  const patchInk = rgb(settings.grungeInk);
  const grunge = settings.texture === 'Grunge'
    ? grungeMask(width, height, { patchSize: settings.patchSize, coverage: settings.coverage, distress: settings.distress, edgeBias: settings.edgeBias }, seed)
    : null;
  const pixels = ctx.createImageData(width, height);
  const amount = settings.texture === 'None' ? 0 : settings.strength;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const n = noise(Math.floor(x / settings.scale), Math.floor(y / settings.scale), seed) - 0.5;
      let grain = n * amount;
      if (settings.texture === 'Paper' && amount) {
        const mottle = smoothNoise(x / (24 * settings.scale), y / (24 * settings.scale), seed + 3) - 0.5;
        const fiber = smoothNoise(x / (1.4 * settings.scale), y / (6 * settings.scale), seed + 7) - 0.5;
        grain = (n * 0.5 + mottle * 0.5 + fiber * 0.55) * amount;
      }
      const distance = ((x / width - 0.5) ** 2 + (y / height - 0.5) ** 2) * 1.6;
      const shade = 1 - distance * settings.vignette;
      const i = (y * width + x) * 4;
      const inkMix = grunge ? grunge[y * width + x] / 255 : 0;
      pixels.data[i] = mix(base[0], patchInk[0], inkMix) * shade + grain;
      pixels.data[i + 1] = mix(base[1], patchInk[1], inkMix) * shade + grain;
      pixels.data[i + 2] = mix(base[2], patchInk[2], inkMix) * shade + grain;
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return surface;
}

function treatment(source: HTMLCanvasElement, settings: Settings['treatment'], seed: number) {
  const surface = canvas(source.width, source.height);
  const ctx = context(surface);
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, surface.width, surface.height);
  const pixels = image.data;
  const ink = rgb(settings.ink), light = rgb(settings.highlight);
  const size = settings.halftoneSize;
  for (let y = 0; y < surface.height; y++) {
    for (let x = 0; x < surface.width; x++) {
      const i = (y * surface.width + x) * 4;
      if (!pixels[i + 3]) continue;
      let r = clamp((pixels[i] - 128) * settings.contrast + 128 + settings.brightness);
      let g = clamp((pixels[i + 1] - 128) * settings.contrast + 128 + settings.brightness);
      let b = clamp((pixels[i + 2] - 128) * settings.contrast + 128 + settings.brightness);
      const luma = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
      if (settings.style === 'Photo') {
        r = mix(luma * 255, r, settings.saturation) + settings.warmth * 0.5;
        g = mix(luma * 255, g, settings.saturation) + settings.warmth * 0.1;
        b = mix(luma * 255, b, settings.saturation) - settings.warmth * 0.5;
      } else {
        let tone = luma;
        if (settings.style === 'Halftone') {
          // A 45° clustered screen with continuous dot growth into full ink.
          const u = (x + y) * Math.SQRT1_2 / size;
          const v = (y - x) * Math.SQRT1_2 / size;
          const distance = Math.hypot(fract(u) - 0.5, fract(v) - 0.5);
          tone = halftoneCoverage(distance) < 1 - luma ? 0 : 1;
        } else if (settings.style === 'Dither') {
          const unit = Math.max(1, Math.round(settings.ditherPixelSize));
          tone = luma > bayer8(Math.floor(x / unit), Math.floor(y / unit)) ? 1 : 0;
        } else if (settings.style === 'Newsprint') {
          const screened = newsprintTone(luma, x, y, settings.stippleSize, settings.inkDensity, seed, settings.printGamma);
          const continuous = Math.max(0, Math.min(1, luma ** settings.printGamma + (50 - settings.inkDensity) / 150));
          tone = mix(continuous, screened, settings.screenStrength);
        }
        r = mix(ink[0], light[0], tone);
        g = mix(ink[1], light[1], tone);
        b = mix(ink[2], light[2], tone);
      }
      const grain = (noise(x, y, seed + 29) - 0.5) * settings.grain * (0.4 + 0.6 * Math.sin(luma * Math.PI));
      pixels[i] = r + grain;
      pixels[i + 1] = g + grain;
      pixels[i + 2] = b + grain;
    }
  }
  ctx.putImageData(image, 0, 0);
  return surface;
}

function coarseMask(source: HTMLCanvasElement, step: number, threshold: number) {
  const { width, height } = source;
  const cols = Math.ceil(width / step), rows = Math.ceil(height / step);
  const pixels = context(source).getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(cols * rows);
  // Max pooling, not bilinear downsampling: preserve narrow hair/silhouette details.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] >= threshold) {
        mask[Math.floor(y / step) * cols + Math.floor(x / step)] = 255;
      }
    }
  }
  return { mask, cols, rows };
}

function border(source: HTMLCanvasElement, settings: Settings['border'], threshold: number, seed: number) {
  const surface = canvas(source.width, source.height);
  const ctx = context(surface);
  if (settings.style === 'None' || (settings.width === 0 && settings.style !== 'Sketch')) return surface;
  ctx.fillStyle = settings.color;
  if (settings.style === 'Sticker') {
    const silhouette = canvas(source.width, source.height);
    const sctx = context(silhouette);
    sctx.drawImage(source, 0, 0);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = settings.color;
    sctx.fillRect(0, 0, source.width, source.height);
    ctx.drawImage(silhouette, 0, 0);
    for (let i = 0; i < 48; i++) {
      const angle = i / 48 * Math.PI * 2;
      ctx.drawImage(silhouette, Math.cos(angle) * settings.width, Math.sin(angle) * settings.width);
    }
  } else {
    const step = settings.style === 'Pixel' ? settings.pixelSize : 4;
    const { mask, cols, rows } = coarseMask(source, step, threshold);
    const expanded = dilate(mask, cols, rows, Math.max(settings.style === 'Sketch' ? 0 : 1, Math.round(settings.width / step)));
    if (settings.style === 'Pixel') {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (expanded[y * cols + x]) ctx.fillRect(x * step, y * step, step, step);
        }
      }
    } else {
      // Trace exposed grid edges, then give each pass a slowly varying pen displacement.
      ctx.strokeStyle = settings.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const occupied = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && expanded[y * cols + x];
      for (let pass = 0; pass < 3; pass++) {
        ctx.lineWidth = settings.sketchStroke * (pass === 0 ? 1 : 0.6);
        ctx.globalAlpha = pass === 0 ? 1 : 0.7;
        ctx.beginPath();
        const segment = (x: number, y: number, dx: number, dy: number) => {
          if (pass && noise(x, y, seed + pass) < 0.23) return;
          const jitter = (a: number, b: number, s: number) =>
            (smoothNoise(a / 20, b / 20, s) - 0.5) * settings.roughness * 2;
          ctx.moveTo(x + jitter(x, y, seed + pass * 5), y + jitter(x, y, seed + pass * 5 + 1));
          const ex = x + dx, ey = y + dy;
          ctx.lineTo(ex + jitter(ex, ey, seed + pass * 5), ey + jitter(ex, ey, seed + pass * 5 + 1));
        };
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          if (!occupied(x, y)) continue;
          if (!occupied(x, y - 1)) segment(x * step, y * step, step, 0);
          if (!occupied(x, y + 1)) segment(x * step, (y + 1) * step, step, 0);
          if (!occupied(x - 1, y)) segment(x * step, y * step, 0, step);
          if (!occupied(x + 1, y)) segment((x + 1) * step, y * step, 0, step);
        }
        ctx.stroke();
      }
    }
  }
  return surface;
}

export class PortraitRenderer {
  private source: HTMLCanvasElement | null = null;
  private bounds: Bounds | null = null;
  private cache = new Map<string, { key: string; surface: HTMLCanvasElement }>();

  setSource(source: ImageBitmap) {
    const surface = canvas(source.width, source.height);
    const ctx = context(surface);
    ctx.drawImage(source, 0, 0);
    const bounds = alphaBounds(ctx.getImageData(0, 0, source.width, source.height).data, source.width, source.height);
    if (!bounds) throw new Error('No visible subject found. Try another image or a transparent PNG.');
    this.source = surface;
    this.bounds = bounds;
    this.cache.clear();
  }

  private cached(name: string, key: unknown, draw: () => HTMLCanvasElement) {
    const serialized = JSON.stringify(key);
    let entry = this.cache.get(name);
    if (!entry || entry.key !== serialized) {
      entry = { key: serialized, surface: draw() };
      this.cache.set(name, entry);
    }
    return entry.surface;
  }

  render(target: HTMLCanvasElement, settings: Settings, format: Format, seed: number) {
    const [width, height] = outputSize(format);
    if (target.width !== width || target.height !== height) {
      target.width = width;
      target.height = height;
    }
    const ctx = context(target);
    ctx.clearRect(0, 0, width, height);
    const bg = this.cached('background', [width, height, settings.background, seed],
      () => background(width, height, settings.background, seed));
    ctx.drawImage(bg, 0, 0);
    if (!this.source || !this.bounds) return;
    const source = this.source;
    const preparationKey = [settings.cutout, settings.recovery];
    const prepared = this.cached('prepared', preparationKey, () => {
      const surface = canvas(source.width, source.height);
      const sourcePixels = context(source).getImageData(0, 0, source.width, source.height);
      const clean = refineMask(sourcePixels.data, source.width, source.height, settings.cutout);
      // Feather inward: never reveal RGB from pixels that were transparent in
      // the source cutout (PNG decoding can make those pixels black).
      for (let i = 3; i < clean.length; i += 4) clean[i] = Math.min(clean[i], sourcePixels.data[i]);
      const corrected = enhanceRGBA(clean, source.width, source.height, settings.recovery);
      sourcePixels.data.set(corrected);
      context(surface).putImageData(sourcePixels, 0, 0);
      return surface;
    });
    const bounds = alphaBounds(context(prepared).getImageData(0, 0, prepared.width, prepared.height).data, prepared.width, prepared.height);
    if (!bounds) throw new Error('Mask cleanup removed the subject. Reduce Cutout → Trim / Cutoff, or refine the mask.');
    const framingKey = [width, height, settings.portrait, preparationKey];
    const framed = this.cached('framed', framingKey, () => {
      const surface = canvas(width, height);
      const p = settings.portrait;
      const cropHeight = bounds.height * (1 - p.cropBottom / 100);
      const scale = Math.min(width * 0.82 / bounds.width, height * 0.86 / cropHeight) * p.zoom;
      const dw = bounds.width * scale, dh = cropHeight * scale;
      const frame = context(surface);
      frame.imageSmoothingEnabled = true;
      frame.imageSmoothingQuality = 'high';
      frame.drawImage(prepared, bounds.x, bounds.y, bounds.width, cropHeight,
        (width - dw) / 2 + width * p.horizontal / 100,
        (height - dh) / 2 + height * p.vertical / 100, dw, dh);
      return surface;
    });
    const edge = this.cached('border', [framingKey, settings.border, seed],
      () => border(framed, settings.border, settings.portrait.maskThreshold, seed));
    const photo = this.cached('photo', [framingKey, settings.treatment, seed],
      () => treatment(framed, settings.treatment, seed));
    const composite = this.cached('composite', [framingKey, settings.border, settings.treatment, seed], () => {
      const surface = canvas(width, height);
      const layer = context(surface);
      if (settings.border.shadow > 0) {
        layer.shadowColor = `rgba(10, 20, 10, ${settings.border.shadow})`;
        layer.shadowBlur = 18;
        layer.shadowOffsetY = 8;
      }
      if (settings.border.style !== 'None' && (settings.border.style === 'Sketch' || settings.border.width > 0)) {
        layer.drawImage(edge, 0, 0);
        layer.shadowColor = 'transparent';
      }
      layer.drawImage(photo, 0, 0);
      // Freeze native shadow rasterization once instead of rerasterizing on each
      // preview/export (Chrome can change precision after its first readback).
      layer.putImageData(layer.getImageData(0, 0, width, height), 0, 0);
      return surface;
    });
    ctx.save();
    if (settings.portrait.flip) { ctx.translate(width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(composite, 0, 0);
    ctx.restore();
  }
}

export async function decodeFile(file: Blob): Promise<ImageBitmap> {
  const image = await createImageBitmap(file);
  if (image.width * image.height > 40_000_000) {
    image.close();
    throw new Error('Please use an image smaller than 40 megapixels.');
  }
  const ratio = Math.min(1, 1800 / Math.max(image.width, image.height));
  if (ratio === 1) return image;
  const surface = canvas(Math.round(image.width * ratio), Math.round(image.height * ratio));
  context(surface).drawImage(image, 0, 0, surface.width, surface.height);
  image.close();
  return createImageBitmap(surface);
}

export async function asBlob(image: ImageBitmap): Promise<Blob> {
  const surface = canvas(image.width, image.height);
  context(surface).drawImage(image, 0, 0);
  return new Promise((resolve, reject) => surface.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare image.')), 'image/png'));
}

export function hasTransparency(image: ImageBitmap) {
  const surface = canvas(image.width, image.height);
  context(surface).drawImage(image, 0, 0);
  const data = context(surface).getImageData(0, 0, surface.width, surface.height).data;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 240) transparent++;
  return transparent / (surface.width * surface.height) > 0.01;
}
