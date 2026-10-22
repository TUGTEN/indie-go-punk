import { describe, expect, it } from 'vitest';
import { compositionLayout, coverRect } from './renderer';
import type { CompositionSettings, Rect } from './types';
import { compositionLayouts } from './layouts';
import { compositionControls } from './settings';

function settings(): CompositionSettings {
  return {
    layout: { split: 0.47, margin: 32, gutter: 24, bubbleHeight: 220, tailX: 0.54, attribution: 'Nameplate', titleHeight: 168 },
    portrait: { zoom: 1, x: 0, y: 0, flip: false },
    gameplay: { width: 1, aspect: 1.78, zoom: 1, x: 0, y: 0, pixelFrame: true },
    typography: { quoteSize: 5, gameSize: 7, nameSize: 3, panelDepth: 1 },
    screen: { paper: '#6f975d', ink: '#203f24', surface: 'LCD', tones: 'Shaded', depth: 1, glow: 0.45, gap: 0.12, threshold: 0.5, invert: false },
    simulation: { algorithm: 'Cyclic CA', width: 160, height: 90, density: 0.32, rule: 90, randomStart: false, states: 8, threshold: 1, wrap: true, settle: 36 },
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.width > 0 && b.width > 0 && a.height > 0 && b.height > 0 &&
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function checkLayout(s: CompositionSettings): void {
  const l = compositionLayout(s);
  for (const r of [l.bubble, l.portrait, l.gameplay, l.gameTitle, l.nameplate]) {
    expect(Object.values(r).every(Number.isInteger)).toBe(true);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(1280);
    expect(r.y + r.height).toBeLessThanOrEqual(720);
  }
  const panels = [l.bubble, l.gameplay, l.gameTitle, l.nameplate];
  panels.forEach((panel, i) => panels.slice(i + 1).forEach(other => expect(overlaps(panel, other)).toBe(false)));
  expect(overlaps(l.portrait, l.bubble)).toBe(false);
  expect(overlaps(l.portrait, l.gameplay)).toBe(false);
  expect(overlaps(l.portrait, l.gameTitle)).toBe(false);
  if (s.layout.arrangement === 'Reversed') expect(l.gameplay.x).toBe(Math.round(s.layout.margin));
  else expect(l.gameplay.x + l.gameplay.width).toBe(1280 - Math.round(s.layout.margin));
  expect(l.gameplay.y).toBe(s.layout.arrangement === 'Banner'
    ? l.bubble.y + l.bubble.height + Math.round(s.layout.gutter) : Math.round(s.layout.margin));
  expect(l.gameplay.y + l.gameplay.height + Math.round(s.layout.gutter)).toBeLessThanOrEqual(l.gameTitle.y);
  // Integer rasterization loses less than one physical pixel of height.
  expect(Math.abs(l.gameplay.width / s.gameplay.aspect - l.gameplay.height)).toBeLessThan(1.001);
  expect(Number.isInteger(l.tail.x) && Number.isInteger(l.tail.y)).toBe(true);
  expect(l.tail.x).toBeGreaterThanOrEqual(l.bubble.x + 16);
  expect(l.tail.x + 32).toBeLessThanOrEqual(l.bubble.x + l.bubble.width - 16);
  expect(l.tail.y + 24).toBeLessThan(720);
  expect(l.tail.x).toBeGreaterThanOrEqual(l.portrait.x);
  expect(l.tail.x + 32).toBeLessThanOrEqual(l.portrait.x + l.portrait.width);
  expect(l.portrait.height).toBeGreaterThanOrEqual(160);
  expect(l.gameplay.width).toBeGreaterThan(16);
  expect(l.gameplay.height).toBeGreaterThan(16);
}

describe('compositionLayout', () => {
  it('defaults older settings to Split and exposes a Split control default', () => {
    const s = settings();
    const old = compositionLayout(s);
    s.layout.arrangement = 'Split';
    expect(compositionLayout(s)).toEqual(old);
    expect(compositionControls.layout.arrangement.default).toBe('Split');
    expect(old.bubble).toEqual({ x: 32, y: 32, width: 560, height: 220 });
  });

  it('mirrors every rectangle and the entire 32px tail footprint', () => {
    const s = settings();
    const split = compositionLayout(s);
    s.layout.arrangement = 'Reversed';
    const reversed = compositionLayout(s);
    for (const key of ['bubble', 'portrait', 'gameplay', 'gameTitle', 'nameplate'] as const) {
      expect(reversed[key]).toEqual({ ...split[key], x: 1280 - split[key].x - split[key].width });
    }
    expect(reversed.tail).toEqual({ x: 1280 - split.tail.x - 32, y: split.tail.y });
    expect(s.portrait.flip).toBe(false);
  });

  it('spans the banner across both columns but keeps the tail above the portrait', () => {
    const s = settings();
    s.layout.arrangement = 'Banner';
    s.layout.attribution = 'In bubble';
    s.layout.bubbleHeight = 300;
    s.layout.titleHeight = 240;
    s.gameplay.aspect = 0.75;
    const l = compositionLayout(s);
    expect(l.bubble.width).toBe(1280 - s.layout.margin * 2);
    expect(l.gameplay.width).toBeLessThan(l.gameTitle.width);
    expect(l.nameplate.height).toBe(0);
    checkLayout(s);
  });

  it('provides four distinct, applicable partial-setting presets', () => {
    expect(compositionLayouts).toHaveLength(4);
    expect(new Set(compositionLayouts.map(preset => preset.id)).size).toBe(4);
    for (const preset of compositionLayouts) {
      const s = settings();
      s.layout = { ...s.layout, ...preset.values.layout };
      checkLayout(s);
    }
  });
  it('keeps all panels bounded and non-overlapping at UI extremes', () => {
    for (const split of [0.38, 0.56]) for (const margin of [16, 56]) for (const gutter of [12, 40]) {
      for (const bubbleHeight of [140, 300]) for (const titleHeight of [96, 240]) {
        for (const arrangement of ['Split', 'Reversed', 'Banner'] as const) for (const width of [0.5, 1]) for (const aspect of [0.75, 2.4]) for (const attribution of ['Nameplate', 'In bubble'] as const) {
          const s = settings();
          s.layout = { arrangement, split, margin, gutter, bubbleHeight, titleHeight, attribution, tailX: split === 0.38 ? 0.2 : 0.8 };
          s.gameplay = { ...s.gameplay, width, aspect };
          checkLayout(s);
        }
      }
    }
  });

  it('also handles fractional interior settings deterministically', () => {
    for (const arrangement of ['Split', 'Reversed', 'Banner'] as const) for (let i = 0; i < 160; i++) {
      const fraction = (i * 73 % 161) / 160;
      const s = settings();
      s.layout.arrangement = arrangement;
      s.layout.split = 0.38 + fraction * 0.18;
      s.layout.margin = 16 + fraction * 40;
      s.layout.gutter = 12 + fraction * 28;
      s.layout.bubbleHeight = 140 + fraction * 160;
      s.layout.titleHeight = 96 + fraction * 144;
      s.gameplay.aspect = 0.75 + fraction * 1.65;
      s.gameplay.width = 0.5 + fraction * 0.5;
      checkLayout(s);
      expect(compositionLayout(s)).toEqual(compositionLayout(s));
    }
  });

  it('reduces width as well as height when a tall gameplay request meets the title', () => {
    const s = settings();
    s.gameplay.aspect = 0.75;
    s.layout.titleHeight = 240;
    const l = compositionLayout(s);
    expect(l.gameplay.width).toBeLessThan(l.gameTitle.width);
    expect(l.gameplay.height).toBeGreaterThan(0);
    checkLayout(s);
  });

  it('moves the tail across the bubble and reserves a nameplate only when selected', () => {
    const s = settings();
    s.layout.tailX = 0.2;
    const left = compositionLayout(s);
    s.layout.tailX = 0.8;
    expect(compositionLayout(s).tail.x).toBeGreaterThan(left.tail.x);
    expect(left.nameplate.height).toBeGreaterThan(0);
    s.layout.attribution = 'In bubble';
    expect(compositionLayout(s).nameplate.height).toBe(0);
  });
});

describe('coverRect', () => {
  it('centers an unzoomed cover crop', () => {
    expect(coverRect(1920, 1080, { x: 0, y: 0, width: 400, height: 400 }, 1, 0, 0)).toEqual({ sx: 420, sy: 0, sw: 1080, sh: 1080 });
  });

  it('never samples outside even for extreme source aspects, zoom and pan', () => {
    for (const [width, height] of [[1, 10000], [10000, 1], [1920, 1080], [333, 777]]) {
      for (const aspect of [0.75, 1, 2.4]) for (const zoom of [1, 1.5, 3]) {
        for (const x of [-100, 0, 100]) for (const y of [-100, 0, 100]) {
          const target = { x: 56, y: 32, width: 300, height: 300 / aspect };
          const crop = coverRect(width!, height!, target, zoom, x, y);
          expect(crop.sx).toBeGreaterThanOrEqual(0);
          expect(crop.sy).toBeGreaterThanOrEqual(0);
          expect(crop.sw).toBeGreaterThan(0);
          expect(crop.sh).toBeGreaterThan(0);
          expect(crop.sx + crop.sw).toBeLessThanOrEqual(width! + 1e-8);
          expect(crop.sy + crop.sh).toBeLessThanOrEqual(height! + 1e-8);
          expect(crop.sw / crop.sh).toBeCloseTo(aspect, 8);
          if (x === -100) expect(crop.sx).toBe(0);
          if (y === -100) expect(crop.sy).toBe(0);
          if (x === 100) expect(crop.sx + crop.sw).toBeCloseTo(width!, 8);
          if (y === 100) expect(crop.sy + crop.sh).toBeCloseTo(height!, 8);
        }
      }
    }
  });

  it('clamps controls and rejects unusable dimensions', () => {
    const target = { x: 0, y: 0, width: 300, height: 200 };
    expect(coverRect(800, 600, target, 99, -999, 999)).toEqual(coverRect(800, 600, target, 3, -100, 100));
    expect(() => coverRect(0, 100, target, 1, 0, 0)).toThrow(RangeError);
    expect(() => coverRect(100, 100, { ...target, height: 0 }, 1, 0, 0)).toThrow(RangeError);
    expect(() => coverRect(100, 100, target, NaN, 0, 0)).toThrow(RangeError);
  });
});
