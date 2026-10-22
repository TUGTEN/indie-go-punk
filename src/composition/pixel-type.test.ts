import { describe, expect, it, vi } from 'vitest';
import { drawPixelText, layoutPixelText, PIXEL_GLYPHS } from './pixel-type';

describe('pixel font', () => {
  it('contains readable seven-row five-bit glyphs for letters, digits and punctuation', () => {
    for (const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?!.,:;-/&+()\'"') {
      expect(PIXEL_GLYPHS[char]).toHaveLength(7);
      expect(PIXEL_GLYPHS[char].every((row) => Number.isInteger(row) && row >= 0 && row <= 31)).toBe(true);
      expect(PIXEL_GLYPHS[char].some(Boolean)).toBe(true);
    }
    expect(PIXEL_GLYPHS.A).toEqual([14, 17, 17, 31, 17, 17, 17]);
  });

  it('wraps words and splits long developer names without dropping letters', () => {
    expect(layoutPixelText('indie game studio', 60, 27, 1).lines).toEqual(['INDIE GAME', 'STUDIO']);
    const name = 'SupercalifragilisticStudio42';
    const result = layoutPixelText(name, 30, 100, 1);
    expect(result.lines.join('')).toBe(name.toUpperCase());
    expect(result.lines.every((line) => line.length <= 5)).toBe(true);
    expect(result.truncated).toBe(false);
  });

  it('preserves explicit blank lines, trailing newlines and unwrapped whitespace', () => {
    expect(layoutPixelText('a\r\n\r\nb\n', 60, 100, 1).lines).toEqual(['A', '', 'B', '']);
    expect(layoutPixelText(' a  b\t', 60, 100, 1).lines).toEqual([' A  B ']);
  });

  it('normalizes accents, lowercase and typographic punctuation with predictable fallback', () => {
    expect(layoutPixelText('Élodie, Zoë & Łukasz “ß” — 🎮漢', 600, 100, 1).lines)
      .toEqual(['ELODIE, ZOE & LUKASZ "SS" - ??']);
    expect(layoutPixelText('cafe\u0301', 100, 100, 1).lines).toEqual(['CAFE']);
  });

  it('chooses the largest fitting integer scale rather than prematurely truncating', () => {
    expect(layoutPixelText('AB CD', 60, 36, 4)).toEqual({
      lines: ['AB CD'], scale: 2, width: 60, height: 18, truncated: false,
    });
    expect(layoutPixelText('ABCD', 24, 9, 8)).toEqual({
      lines: ['ABCD'], scale: 1, width: 24, height: 9, truncated: false,
    });
    expect(layoutPixelText('A', 100, 100, 3.9).scale).toBe(3);
  });

  it('truncates at scale one with an ellipsis that also fits narrow bounds', () => {
    expect(layoutPixelText('ABCDEFGHIJK', 36, 9, 4)).toEqual({
      lines: ['ABC...'], scale: 1, width: 36, height: 9, truncated: true,
    });
    expect(layoutPixelText('ABC', 6, 9, 1).lines).toEqual(['.']);
    expect(layoutPixelText('ABC', 12, 9, 1).lines).toEqual(['..']);
    expect(layoutPixelText('A\nB\nC', 30, 18, 1).lines).toEqual(['A', 'B...']);
  });

  it('caps untrusted text and reports omitted content', () => {
    const result = layoutPixelText('A'.repeat(100_000), 6000, 9000, 1);
    expect(result.truncated).toBe(true);
    expect(result.lines.join('').length).toBe(1000);
    expect(result.lines.at(-1)?.endsWith('...')).toBe(true);
  });

  it('handles empty content, invalid dimensions and invalid preferred scales', () => {
    expect(layoutPixelText('', 0, 0, 3.8)).toEqual({ lines: [], scale: 3, width: 0, height: 0, truncated: false });
    for (const width of [0, -1, NaN, 5.9]) {
      expect(layoutPixelText('A', width, 100, 1)).toEqual({ lines: [], scale: 1, width: 0, height: 0, truncated: true });
    }
    for (const scale of [0, -5, NaN, Infinity]) {
      expect(layoutPixelText('A', 6, 9, scale).scale).toBe(1);
    }
    expect(layoutPixelText('A', 100, 8, 1).lines).toEqual([]);
    expect(layoutPixelText('A', Infinity, Infinity, 2).scale).toBe(2);
    expect(layoutPixelText('A\nB', 1e15, 1e15, 1e15).scale).toBe(Math.floor(1e15 / 18));
  });

  it('produces bounded integer deterministic geometry across sizes', () => {
    for (let width = 6; width <= 100; width += 7) {
      for (let height = 9; height <= 100; height += 11) {
        const args = ['HELLO SUPERLONGNAME\nGAME 42!', width, height, 5] as const;
        const result = layoutPixelText(...args);
        expect(layoutPixelText(...args)).toEqual(result);
        expect(result.width).toBeLessThanOrEqual(width);
        expect(result.height).toBeLessThanOrEqual(height);
        expect(Number.isInteger(result.scale)).toBe(true);
        expect(result.width).toBe(Math.max(...result.lines.map((line) => line.length)) * 6 * result.scale);
        expect(result.height).toBe(result.lines.length * 9 * result.scale);
      }
    }
  });

  it('draws native integer cells matching layout, without canvas fonts', () => {
    const fillRect = vi.fn();
    const fillText = vi.fn();
    const ctx = { fillRect, fillText, fillStyle: '' } as unknown as CanvasRenderingContext2D;
    const result = drawPixelText(ctx, 'A\n?', 10.8, 20.9, 24, 36, 2, '#ff00aa');
    expect(result).toEqual(layoutPixelText('A\n?', 24, 36, 2));
    expect(ctx.fillStyle).toBe('#ff00aa');
    expect(fillText).not.toHaveBeenCalled();
    expect(fillRect).toHaveBeenCalledWith(12, 20, 2, 2);
    for (const [x, y, w, h] of fillRect.mock.calls) {
      expect([x, y, w, h].every(Number.isInteger)).toBe(true);
      expect(w).toBe(2);
      expect(h).toBe(2);
      expect(x).toBeGreaterThanOrEqual(10);
      expect(y).toBeGreaterThanOrEqual(20);
      expect(x + w).toBeLessThanOrEqual(10 + result.width);
      expect(y + h).toBeLessThanOrEqual(20 + result.height);
    }
    fillRect.mockClear();
    drawPixelText(ctx, ' ', 0, 0, 6, 9, 1, '#000');
    drawPixelText(ctx, 'A', 0, 0, 0, 0, 1, '#000');
    expect(fillRect).not.toHaveBeenCalled();
  });
});
