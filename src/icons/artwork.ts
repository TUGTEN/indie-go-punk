import type { PixelIcon } from './library';

export const effects = ['None', 'Glitch', 'Blink', 'Build', 'Scan', 'Hit', 'Ghost'] as const;
export type IconEffect = typeof effects[number];
export type Surface = 'Flat' | 'LCD' | 'Backlit';
export type ArtworkOptions = {
  size: number;
  ink: string;
  paper: string;
  surface: Surface;
  depth: number;
  glow: number;
  effect: IconEffect;
  phase: number;
  background: boolean;
  grid?: boolean;
};

const bounded = (value: number, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const color = (value: string, fallback: string) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
const number = (value: number) => String(Math.round(value * 10000) / 10000);

/** Sample an immediate one-shot. The caller owns its ~1 second clock and uses
 * phase 0 for reduced motion. Endpoints are identical; no autonomous animation,
 * random flicker, fractional-cell travel, or blurred foreground is emitted.
 */
export function framePlan(effect: IconEffect, phase: number) {
  const p = bounded(phase, 0, 0, 1);
  const active = p > 0 && p < 0.9;
  return {
    opacity: effect === 'Blink' && active ? (p <= 0.55 ? 0.12 : 0.12 + 0.88 * (p - 0.55) / 0.35) : 1,
    glitch: effect === 'Glitch' && active,
    glitchStep: effect === 'Glitch' && active ? Math.min(2, Math.floor(p / 0.3)) : 0,
    build: effect === 'Build' && active ? Math.floor(p / 0.9 * 64) : 64,
    scan: effect === 'Scan' && active ? Math.min(14, Math.floor(p / 0.9 * 16)) : -2,
    hit: effect === 'Hit' && active && p < 0.72,
    knock: effect === 'Hit' && active ? (p < 0.65 ? -2 : -1) : 0,
    ghost: effect === 'Ghost' && active ? (p < 0.7 ? 2 : 1) : 0,
  };
}

/** A standalone, deterministic sampled SVG, shared by preview and raster export. */
export function iconArtworkSvg(icon: PixelIcon, options: ArtworkOptions): string {
  const size = Math.round(bounded(options.size, 192, 16, 2048));
  const surface = ['Flat', 'LCD', 'Backlit'].includes(options.surface) ? options.surface : 'LCD';
  const ink = color(options.ink, '#2D612D');
  const paper = color(options.paper, '#477E43');
  const depth = bounded(options.depth, 1, 0, 2);
  const glow = bounded(options.glow, 0, 0, 2);
  const effect = effects.includes(options.effect) ? options.effect : 'None';
  const frame = framePlan(effect, options.phase);
  const path: string[] = [];
  // Rank occupied blocks, so sparse icons still build throughout the one-shot.
  const blocks = [...new Set(icon.rows.slice(0, 16).flatMap((row, y) =>
    [...row.slice(0, 16)].flatMap((cell, x) => cell === '#' ? [Math.floor(y / 2) * 8 + Math.floor(x / 2)] : [])))].sort((a, b) => a - b);
  const revealed = Math.floor(frame.build / 64 * blocks.length);
  const occupiedRows = icon.rows.slice(0, 16).flatMap((row, y) => row.slice(0, 16).includes('#') ? [y] : []);
  // Start on actual ink, not empty framing rows, for immediate scan feedback.
  const scanY = frame.scan === -2 ? -2 : occupiedRows[Math.floor(frame.scan / 15 * occupiedRows.length)] ?? 0;
  for (let y = 0; y < Math.min(16, icon.rows.length); y++) {
    const row = icon.rows[y];
    for (let x = 0; x < Math.min(16, row.length); x++) {
      if (row[x] !== '#') continue;
      // Reveal 2x2 cell blocks once in row-major order, never opacity flicker.
      if (blocks.indexOf(Math.floor(y / 2) * 8 + Math.floor(x / 2)) >= revealed) continue;
      // Three held tear patterns: two hard horizontal bands, never render-time noise.
      const bands = [[3, 6, 10, 13], [5, 8, 12, 15], [1, 4, 8, 11]][frame.glitchStep];
      const dx = !frame.glitch ? 0 : y >= bands[0] && y < bands[1] ? 2
        : y >= bands[2] && y < bands[3] ? -2 : 0;
      path.push(`M${x + dx + frame.ghost + frame.knock} ${y}h1v1h-1z`);
    }
  }
  const geometry = path.join('');
  // Encode rather than strip punctuation so "a/b" and "a b" remain distinct.
  // A deterministic frame namespace also isolates multiple variants of one icon
  // in the same document. Identical instances may safely share identical defs.
  let fingerprint = 2166136261;
  const signature = JSON.stringify([geometry, ink, paper, depth, glow, frame, surface, options.background, options.grid]);
  for (let i = 0; i < signature.length; i++) {
    fingerprint = Math.imul(fingerprint ^ signature.charCodeAt(i), 16777619) >>> 0;
  }
  const prefix = `pixel-${Array.from(icon.id).map((c) => c.codePointAt(0)!.toString(16)).join('-') || 'empty'}-${fingerprint.toString(16)}`;
  const id = (suffix: string) => `${prefix}-${suffix}`;
  const ref = (suffix: string) => `url(#${id(suffix)})`;
  const defs = [
    `<path id="${id('glyph')}" d="${geometry}"/>`,
    `<filter id="${id('shadow')}" x="-4" y="-4" width="24" height="24" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${number(0.25 * depth)}"/></filter>`,
    `<radialGradient id="${id('light')}" cx="45%" cy="38%" r="75%"><stop stop-color="#FFE3A0" stop-opacity="${number(0.16 + glow * 0.12)}"/><stop offset=".6" stop-color="#E6AA42" stop-opacity="${number(0.08 + glow * 0.07)}"/><stop offset="1" stop-color="#664017" stop-opacity=".22"/></radialGradient>`,
    `<radialGradient id="${id('shade')}" r="70%"><stop offset=".55" stop-color="#173C1C" stop-opacity="0"/><stop offset="1" stop-color="#173C1C" stop-opacity=".22"/></radialGradient>`,
    `<linearGradient id="${id('sheen')}" x2=".3" y2="1"><stop stop-color="#FFF4CE" stop-opacity="${surface === 'Backlit' ? '.10' : '.04'}"/><stop offset=".45" stop-color="#FFF4CE" stop-opacity=".025"/><stop offset="1" stop-color="#FFF4CE" stop-opacity="0"/></linearGradient>`,
    `<clipPath id="${id('scan-clip')}"><rect x="-2" y="${scanY}" width="20" height="2"/></clipPath>`,
    `<clipPath id="${id('scan-edge')}"><rect x="-2" y="${scanY}" width="20" height="0.25"/></clipPath>`,
    `<pattern id="${id('grid')}" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="${ink}" stroke-opacity=".08" stroke-width=".035"/></pattern>`,
  ].join('');
  const background = options.background ? [
    `<rect width="20" height="20" fill="${paper}"/>`,
    surface === 'Backlit' ? `<rect width="20" height="20" fill="${ref('light')}"/>` : '',
    surface !== 'Flat' ? `<rect width="20" height="20" fill="${ref('shade')}"/><rect x=".15" y=".15" width="19.7" height="19.7" fill="none" stroke="#173C1C" stroke-opacity=".22" stroke-width=".3"/><rect width="20" height="20" fill="${ref('sheen')}"/>` : '',
  ].join('') : '';
  const shadow = surface !== 'Flat' && depth > 0
    ? `<use data-layer="rear-shadow" href="#${id('glyph')}" fill="#173C1C" opacity=".18" transform="translate(${number(0.25 * depth)} ${number(5 / 12 * depth)})" filter="${ref('shadow')}"/>` : '';
  const trail = frame.ghost !== 0
    ? `<use data-layer="ghost-far" href="#${id('glyph')}" transform="translate(${-2 * frame.ghost} 0)" fill="${ink}" opacity=".18"/><use data-layer="ghost" href="#${id('glyph')}" transform="translate(${-frame.ghost} 0)" fill="${ink}" opacity=".35"/>` : '';
  // Opaque RGB silhouettes, not tinted shadows: each channel has exposed edges.
  // The subdued front lets the channel colors survive actual raster compositing.
  const rgb = frame.glitch ? [
    ['red', '#ff2450', -1, 0], ['green', '#2dff83', 1, -1], ['blue', '#397bff', 0, 1],
  ].map(([channel, fill, x, y]) => `<use data-layer="glitch-${channel}" shape-rendering="crispEdges" style="mix-blend-mode:screen" href="#${id('glyph')}" fill="${fill}" transform="translate(${x} ${y})"/>`).join('') : '';
  const scan = frame.scan !== -2
    ? `<use data-layer="scan" href="#${id('glyph')}" fill="#FFF4CE" opacity=".9" clip-path="${ref('scan-clip')}"/><use data-layer="scan-edge" href="#${id('glyph')}" fill="#ffffff" clip-path="${ref('scan-edge')}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 20 20" role="img" aria-labelledby="${id('title')}"><title id="${id('title')}">${escapeXml(icon.name)}</title><defs>${defs}</defs>${background}${options.grid ? `<rect x="2" y="2" width="16" height="16" fill="${ref('grid')}"/>` : ''}<g transform="translate(2 2)" opacity="${number(frame.opacity)}" shape-rendering="crispEdges">${shadow}${trail}${rgb ? `<g data-layer="rgb-split" style="isolation:isolate">${rgb}</g>` : ''}<use data-layer="front" shape-rendering="crispEdges" href="#${id('glyph')}" fill="${frame.hit ? '#FFF4CE' : ink}" opacity="${frame.glitch ? '.18' : '1'}"/>${scan}</g></svg>`;
}
