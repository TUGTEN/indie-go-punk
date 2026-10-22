import { describe, expect, it } from 'vitest';
import { cellTone, fieldGeometry, mixInk, motifGeometry, renderLcd, type LcdRenderOptions } from './renderer';
import { seedLife } from './automata';

const options: LcdRenderOptions = {
  paper: '#477e43', ink: '#2d612d', surface: 'LCD', tones: 'Two tone',
  depth: 1, glow: 0.5, gap: 0.125, threshold: 0.5, invert: false,
  motif: null, motifScale: 1,
};

describe('LCD colors and state mapping', () => {
  it('mixes exact endpoints and rounded RGB channels without swapping the palette', () => {
    expect(mixInk('#477E43', '#2D612D', 0)).toBe('#477e43');
    expect(mixInk('#477E43', '#2D612D', 1)).toBe('#2d612d');
    expect(mixInk('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixInk('#123456', '#abcdef', -1)).toBe('#123456');
    expect(mixInk('#123456', '#abcdef', 2)).toBe('#abcdef');
  });

  it.each(['red', '#fff', '#11223344', '#gg1234', '112233'])('rejects invalid color %s', color => {
    expect(() => mixInk(color, '#000000', 0.5)).toThrow(RangeError);
    expect(() => mixInk('#000000', color, 0.5)).toThrow(RangeError);
  });

  it('includes the two-tone threshold boundary and inverts the result', () => {
    expect([0, 1, 2, 3, 4].map(value => cellTone(value, 5, 'Two tone', 0.5, false)))
      .toEqual([0, 0, 1, 1, 1]);
    expect([0, 1, 2, 3, 4].map(value => cellTone(value, 5, 'Two tone', 0.5, true)))
      .toEqual([1, 1, 0, 0, 0]);
    expect(cellTone(0, 2, 'Two tone', 0, false)).toBe(1);
    expect(cellTone(3, 5, 'Two tone', 1, false)).toBe(0);
    expect(cellTone(4, 5, 'Two tone', 1, false)).toBe(1);
  });

  it('shades every state linearly, independently of threshold', () => {
    expect([0, 1, 2, 3, 4].map(value => cellTone(value, 5, 'Shaded', 1, false)))
      .toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(cellTone(1, 5, 'Shaded', 0, true)).toBe(0.75);
    expect(cellTone(0, 2, 'Shaded', 0.5, false)).toBe(0);
    expect(cellTone(1, 2, 'Shaded', 0.5, false)).toBe(1);
  });

  it('rejects nonfinite amounts and invalid states', () => {
    expect(() => mixInk('#000000', '#ffffff', NaN)).toThrow(RangeError);
    expect(() => cellTone(2, 2, 'Shaded', 0.5, false)).toThrow(RangeError);
    expect(() => cellTone(-1, 2, 'Shaded', 0.5, false)).toThrow(RangeError);
    expect(() => cellTone(0, 1, 'Shaded', 0.5, false)).toThrow(RangeError);
    expect(() => cellTone(0, 2, 'Shaded', Infinity, false)).toThrow(RangeError);
  });
});

describe('LCD integer layout', () => {
  it('fits the default field exactly at eight-pixel pitch', () => {
    expect(fieldGeometry(160, 90, 0.125)).toEqual({ pitch: 8, cellSize: 7, x: 0, y: 0 });
    expect(fieldGeometry(160, 90, 0).cellSize).toBe(8);
  });

  it.each([[512, 256], [1, 1], [127, 83], [160, 90]])('centers %i by %i without fractional pixel edges', (width, height) => {
    const layout = fieldGeometry(width, height, 0.45);
    expect(Object.values(layout).every(Number.isInteger)).toBe(true);
    expect(layout.cellSize).toBeGreaterThanOrEqual(1);
    expect(layout.x).toBeGreaterThanOrEqual(0);
    expect(layout.y).toBeGreaterThanOrEqual(0);
    expect(Math.abs(WIDTH - width * layout.pitch - 2 * layout.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(HEIGHT - height * layout.pitch - 2 * layout.y)).toBeLessThanOrEqual(1);
  });

  it('clamps gap and rejects invalid dimensions', () => {
    expect(fieldGeometry(160, 90, -1).cellSize).toBe(8);
    expect(fieldGeometry(160, 90, 9).cellSize).toBe(4);
    expect(() => fieldGeometry(513, 90, 0)).toThrow(RangeError);
    expect(() => fieldGeometry(160, 257, 0)).toThrow(RangeError);
    expect(() => fieldGeometry(0, 90, 0)).toThrow(RangeError);
  });

  it('centers a whole-cell stencil and preserves bounded padding', () => {
    expect(motifGeometry(160, 90, 2)).toEqual({
      x: 64, y: 29, size: 32, scale: 2, left: 63, top: 28, right: 97, bottom: 62,
    });
    expect(motifGeometry(16, 16, 4)).toEqual({
      x: 0, y: 0, size: 16, scale: 1, left: 0, top: 0, right: 16, bottom: 16,
    });
    expect(motifGeometry(15, 90, 1)).toBeNull();
    expect(motifGeometry(160, 90, 100)?.scale).toBe(4);
    expect(motifGeometry(160, 90, -1)?.scale).toBe(1);
    expect(motifGeometry(33, 33, 4)?.scale).toBe(2);
  });
});

const WIDTH = 1280;
const HEIGHT = 720;

describe('LCD field validation before canvas access', () => {
  // No DOM needed: malformed inputs must fail before a canvas is read or modified.
  const unusedCanvas = null!;
  it('rejects truncated cells and out-of-range cell states without mutation', () => {
    const field = seedLife(16, 16, 1, 0.5);
    const before = field.cells.slice();
    expect(() => renderLcd(unusedCanvas, { ...field, cells: field.cells.slice(1) }, options)).toThrow(RangeError);
    const invalid = { ...field, cells: field.cells.slice() };
    invalid.cells[0] = 2;
    expect(() => renderLcd(unusedCanvas, invalid, options)).toThrow(RangeError);
    expect(field.cells).toEqual(before);
  });

  it('rejects bad palette and stencil inputs before painting', () => {
    const field = seedLife(16, 16, 1, 0.5);
    expect(() => renderLcd(unusedCanvas, field, { ...options, ink: '#fff' })).toThrow(RangeError);
    expect(() => renderLcd(unusedCanvas, field, {
      ...options, motif: { id: 'bad', name: 'Bad', category: 'Test', rows: ['#'] },
    })).toThrow(RangeError);
  });
});
