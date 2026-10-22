import { encodeApng, type ApngFrame } from './apng';
import { iconArtworkSvg, type ArtworkOptions, type IconEffect } from './artwork';
import type { PixelIcon } from './library';
export type IconAnimationLook = Pick<ArtworkOptions, 'ink' | 'paper' | 'surface' | 'depth' | 'glow'>;

/** A clean poster frame, one full effect, then a quiet hold before a possible loop. */
export function animationFrames(speed: number): { phase: number; duration: number }[] {
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 4) throw new RangeError('Animation speed must be 0.5–4×');
  const duration = Math.round(1200 / speed);
  const count = Math.ceil(duration / 40);
  const frames = [{ phase: 0, duration: 60 }];
  for (let i = 0; i < count; i++) frames.push({ phase: (i + 0.5) / count, duration: Math.floor((i + 1) * duration / count) - Math.floor(i * duration / count) });
  frames.push({ phase: 0, duration: 1000 });
  return frames;
}
export async function exportIconAnimation(icon: PixelIcon, look: IconAnimationLook, effect: IconEffect, speed: number, size: number, loop: boolean, progress?: (current: number, total: number) => void): Promise<Blob> {
  if (effect === 'None') throw new Error('Choose a motion effect before downloading an animation.');
  if (!Number.isInteger(size) || size < 20 || size > 400) throw new RangeError('Icon export size must be 20–400 pixels');
  const plan = animationFrames(speed);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas2D is unavailable');
  const frames: ApngFrame[] = [];
  for (const [index, frame] of plan.entries()) {
    // Screen, grids and UI framing are intentionally excluded: alpha stays real.
    const markup = iconArtworkSvg(icon, { ...look, size, background: false, grid: false, effect, phase: frame.phase });
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    try {
      const image = new Image(); image.src = url; await image.decode();
      ctx.clearRect(0, 0, size, size); ctx.drawImage(image, 0, 0);
      frames.push({ rgba: ctx.getImageData(0, 0, size, size).data, duration: frame.duration });
    } finally { URL.revokeObjectURL(url); }
    progress?.(index + 1, plan.length);
  }
  return encodeApng(size, size, frames, loop ? 0 : 1);
}
