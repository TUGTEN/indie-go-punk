import { describe, expect, it } from 'vitest';
import { screenPalettes } from './palettes';
import { compositionPalettes } from './composition/settings';
import { mixInk } from './lcd/renderer';
describe('shared screen palettes', () => {
  it('shares the full catalog with Compose, including Pocket Blue', () => {
    expect(compositionPalettes).toBe(screenPalettes);
    for (const id of ['pocket-blue', 'violet', 'neon-cyan', 'neon-pink', 'neon-lime', 'red-chalk', 'red-screen']) expect(screenPalettes.some(p => p.id === id)).toBe(true);
  });
  it('has distinct safe names, ids, and color endpoints for tinted shades', () => {
    expect(new Set(screenPalettes.map(p => p.name)).size).toBe(screenPalettes.length);
    expect(new Set(screenPalettes.map(p => p.id)).size).toBe(screenPalettes.length);
    for (const palette of screenPalettes) {
      expect(palette.paper).toMatch(/^#[0-9a-f]{6}$/); expect(palette.ink).toMatch(/^#[0-9a-f]{6}$/);
      expect(palette.paper).not.toBe(palette.ink);
      expect(mixInk(palette.paper, palette.ink, 0.5)).not.toBe(palette.paper);
    }
  });
});
