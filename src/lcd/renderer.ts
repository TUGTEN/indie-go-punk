import type { Field } from './automata';
import type { PixelIcon } from '../icons/library';

export type LcdRenderOptions = {
  paper: string;
  ink: string;
  surface: 'Flat' | 'LCD' | 'Backlit';
  tones: 'Two tone' | 'Shaded';
  depth: number;
  glow: number;
  gap: number;
  threshold: number;
  invert: boolean;
  motif: PixelIcon | null;
  motifScale: number;
};

const WIDTH = 1280;
const HEIGHT = 720;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Expected a finite number');
  return Math.max(min, Math.min(max, value));
}

function integer(value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`Expected an integer in ${min}..${max}`);
  }
}

function rgb(color: string): number[] {
  if (!/^#[\da-f]{6}$/i.test(color)) throw new RangeError('Expected a six-digit hex color');
  return [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));
}

/** Interpolate encoded RGB channels; endpoints are exact, amounts are clamped. */
export function mixInk(paper: string, ink: string, amount: number): string {
  const from = rgb(paper);
  const to = rgb(ink);
  const t = clamp(amount, 0, 1);
  return '#' + from.map((channel, index) =>
    Math.round(channel + (to[index]! - channel) * t).toString(16).padStart(2, '0')).join('');
}

export function cellTone(
  value: number, states: number, tones: LcdRenderOptions['tones'], threshold: number, invert: boolean,
): number {
  integer(states, 2, 16);
  integer(value, 0, states - 1);
  const cutoff = clamp(threshold, 0, 1);
  if (tones !== 'Two tone' && tones !== 'Shaded') throw new RangeError('Unknown tones');
  const amount = tones === 'Shaded' ? value / (states - 1) : Number(value >= cutoff * (states - 1));
  return invert ? 1 - amount : amount;
}

export function fieldGeometry(width: number, height: number, gap: number) {
  integer(width, 1, 512);
  integer(height, 1, 256);
  const pitch = Math.max(1, Math.floor(Math.min(WIDTH / width, HEIGHT / height)));
  // Integer edges keep even Flat + Two tone strictly two-color, without antialias fringes.
  const separation = Math.min(pitch - 1, Math.round(pitch * clamp(gap, 0, 0.45)));
  return {
    pitch, cellSize: pitch - separation,
    x: Math.floor((WIDTH - width * pitch) / 2),
    y: Math.floor((HEIGHT - height * pitch) / 2),
  };
}

/** Coordinates in field cells. A too-small field omits the motif rather than squishing it. */
export function motifGeometry(width: number, height: number, requestedScale: number) {
  integer(width, 1, 512);
  integer(height, 1, 256);
  const scale = Math.min(Math.floor(clamp(requestedScale, 1, 4)), Math.floor(Math.min(width, height) / 16));
  if (scale < 1) return null;
  const size = 16 * scale;
  const x = Math.floor((width - size) / 2);
  const y = Math.floor((height - size) / 2);
  return {
    x, y, size, scale,
    left: Math.max(0, x - 1), top: Math.max(0, y - 1),
    right: Math.min(width, x + size + 1), bottom: Math.min(height, y + size + 1),
  };
}

function validateField(field: Field): void {
  integer(field.width, 1, 512);
  integer(field.height, 1, 256);
  integer(field.states, 2, 16);
  if (!(field.cells instanceof Uint8Array) || field.cells.length !== field.width * field.height) {
    throw new RangeError('cells must be a Uint8Array matching the field dimensions');
  }
  for (const value of field.cells) integer(value, 0, field.states - 1);
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  // Pin the CPU/readback path: Chromium can migrate a frequently-read GPU canvas
  // after a few frames, changing blur rounding and breaking seed/export parity.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas2D is unavailable');
  return ctx;
}

/** One deterministic raster path for both the preview and PNG export; no clock or DPR inputs. */
export function renderLcd(canvas: HTMLCanvasElement, field: Field, options: LcdRenderOptions): void {
  validateField(field);
  rgb(options.paper);
  rgb(options.ink);
  if (!['Flat', 'LCD', 'Backlit'].includes(options.surface)) throw new RangeError('Unknown surface');
  const layout = fieldGeometry(field.width, field.height, options.gap);
  const depth = clamp(options.depth, 0, 4);
  const glow = clamp(options.glow, 0, 1);
  const palette = Array.from({ length: field.states }, (_, value) => {
    const tone = cellTone(value, field.states, options.tones, options.threshold, options.invert);
    return { tone, color: mixInk(options.paper, options.ink, tone) };
  });
  const motif = motifGeometry(field.width, field.height, options.motifScale);
  if (options.motif && (options.motif.rows.length !== 16 ||
    options.motif.rows.some(row => !/^[.#]{16}$/.test(row)))) {
    throw new RangeError('Motif must be a 16 by 16 pixel stencil');
  }
  if (canvas.width !== WIDTH) canvas.width = WIDTH;
  if (canvas.height !== HEIGHT) canvas.height = HEIGHT;
  const ctx = context(canvas);
  const foreground = canvas.ownerDocument.createElement('canvas');
  foreground.width = WIDTH;
  foreground.height = HEIGHT;
  const front = context(foreground);
  const draw = (x: number, y: number, color: string) => {
    front.fillStyle = color;
    front.fillRect(layout.x + x * layout.pitch, layout.y + y * layout.pitch, layout.cellSize, layout.cellSize);
  };
  for (let y = 0; y < field.height; y++) {
    for (let x = 0; x < field.width; x++) {
      const entry = palette[field.cells[y * field.width + x]!]!;
      if (entry.tone > 0) draw(x, y, entry.color);
    }
  }
  if (options.motif && motif) {
    front.clearRect(
      layout.x + motif.left * layout.pitch, layout.y + motif.top * layout.pitch,
      (motif.right - motif.left) * layout.pitch, (motif.bottom - motif.top) * layout.pitch,
    );
    options.motif.rows.forEach((row, y) => {
      [...row].forEach((pixel, x) => {
        if (pixel !== '#') return;
        for (let dy = 0; dy < motif.scale; dy++) {
          for (let dx = 0; dx < motif.scale; dx++) {
            draw(motif.x + x * motif.scale + dx, motif.y + y * motif.scale + dy, options.ink);
          }
        }
      });
    });
  }

  ctx.save();
  try {
    ctx.resetTransform();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = options.paper;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (options.surface !== 'Flat') {
      // Broad reflector variation, never a blur on the complete composition.
      const wash = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      wash.addColorStop(0, 'rgba(255,255,255,0.04)');
      wash.addColorStop(0.5, 'rgba(255,255,255,0)');
      wash.addColorStop(1, 'rgba(0,0,0,0.03)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      if (options.surface === 'Backlit' && glow > 0) {
        const light = ctx.createRadialGradient(640, 300, 0, 640, 360, 740);
        light.addColorStop(0, `rgba(255,242,181,${0.16 * glow})`);
        light.addColorStop(1, 'rgba(255,242,181,0)');
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
      if (depth > 0) {
        const rear = canvas.ownerDocument.createElement('canvas');
        rear.width = WIDTH;
        rear.height = HEIGHT;
        const back = context(rear);
        back.drawImage(foreground, 0, 0);
        back.globalCompositeOperation = 'source-in';
        back.fillStyle = '#173C1C';
        back.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.globalAlpha = 0.18;
        // CSS blur uses sigma; 3px approximates the recipe's 6px layer-blur radius.
        ctx.filter = `blur(${3 * depth}px)`;
        ctx.drawImage(rear, 3 * depth, 5 * depth);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
      }
    }
    ctx.drawImage(foreground, 0, 0);
    if (options.surface === 'Backlit' && glow > 0) {
      ctx.strokeStyle = `rgba(255,249,207,${0.12 * glow})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, WIDTH - 1, HEIGHT - 1);
    }
  } finally {
    ctx.restore();
  }
}
