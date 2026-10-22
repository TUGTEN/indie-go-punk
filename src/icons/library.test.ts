import { describe, expect, it, vi } from 'vitest';
import { drawPixelIcon, iconPath, icons, iconSvg, type PixelIcon } from './library';

const first = icons[0]!;

describe('original pixel library', () => {
  it('contains the requested 32 distinct drawings in four balanced categories', () => {
    const expected = [
      'controller', 'joystick', 'handheld', 'arcade', 'cartridge', 'monitor', 'keyboard', 'mouse',
      'code', 'terminal', 'bug', 'wrench', 'hammer', 'pencil', 'brush', 'layers',
      'heart', 'skull', 'sword', 'shield', 'potion', 'coin', 'gem', 'flag',
      'microphone', 'headphones', 'speaker', 'music', 'play', 'pause', 'save', 'cursor',
    ];
    expect(icons.map((icon) => icon.id)).toEqual(expected);
    expect(new Set(icons.map((icon) => icon.id)).size).toBe(32);
    expect(new Set(icons.map((icon) => icon.rows.join(''))).size).toBe(32);
    for (const category of ['Hardware', 'Development', 'Game', 'Audio & UI']) {
      expect(icons.filter((icon) => icon.category === category)).toHaveLength(8);
    }
  });

  for (const icon of icons) {
    it(`${icon.id}: is a nonempty 16×16 binary drawing`, () => {
      expect(icon.name.length).toBeGreaterThan(0);
      expect(icon.rows).toHaveLength(16);
      for (const row of icon.rows) expect(row).toMatch(/^[.#]{16}$/);
      expect(icon.rows.join('')).toContain('#');
    });

    it(`${icon.id}: SVG runs cover each filled cell exactly once and no empty cells`, () => {
      const path = iconPath(icon);
      const coverage = Array.from({ length: 16 }, () => Array<number>(16).fill(0));
      const commands = [...path.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)];
      expect(commands.map((match) => match[0]).join('')).toBe(path);
      for (const match of commands) {
        const x = Number(match[1]);
        const y = Number(match[2]);
        const width = Number(match[3]);
        expect(width).toBe(Number(match[4]));
        expect(width).toBeGreaterThan(0);
        expect(y).toBeLessThan(16);
        expect(x + width).toBeLessThanOrEqual(16);
        // A run must be maximal, not a sequence of per-pixel boxes.
        expect(icon.rows[y]![x - 1]).not.toBe('#');
        expect(icon.rows[y]![x + width]).not.toBe('#');
        for (let column = x; column < x + width; column++) coverage[y]![column]!++;
      }
      expect(coverage).toEqual(icon.rows.map((row) => [...row].map((cell) => Number(cell === '#'))));
      expect(iconSvg(icon)).toContain(`d="${path}"`);
    });
  }
});

describe('SVG export safety and sizing', () => {
  it('exports transparent, titled, crisp SVG with default sizing', () => {
    const svg = iconSvg(first);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="128" height="128"');
    expect(svg).toContain('viewBox="0 0 16 16"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<title>Controller</title>');
    expect(svg).toContain('fill="#111111"');
    expect(svg).not.toMatch(/<rect|background|stroke/);
  });

  it.each(['#000000', '#FFFFFF', '#aBcD09'])('accepts six-digit hex %s', (color) => {
    expect(iconSvg(first, color)).toContain(`fill="${color}"`);
  });

  it.each(['red', '#fff', '#12345678', '123456', '#12345g', '#123456" onload="alert(1)', 'url(x)', '#123456\n'])('rejects unsafe or invalid color %j', (color) => {
    expect(() => iconSvg(first, color)).toThrow(/six-digit hex/);
  });

  it.each([[0, 16], [-10, 16], [1, 16], [1.6, 32], [8, 128], [64, 1024], [100, 1024], [NaN, 128], [Infinity, 128], [-Infinity, 128]])('normalizes scale %s to size %s', (scale, size) => {
    expect(iconSvg(first, '#112233', scale)).toContain(`width="${size}" height="${size}"`);
  });

  it('escapes all XML-sensitive title characters', () => {
    expect(iconSvg({ ...first, name: `<&>"'` })).toContain('<title>&lt;&amp;&gt;&quot;&apos;</title>');
  });

  it('supports empty drawings without inventing pixels', () => {
    const empty: PixelIcon = { id: 'empty', name: 'Empty', category: 'Test', rows: Array<string>(16).fill('................') };
    expect(iconPath(empty)).toBe('');
  });
});

describe('canvas renderer', () => {
  it('fills the same integer-cell runs at the requested origin and scale', () => {
    const fillRect = vi.fn();
    const ctx = { fillStyle: '', fillRect };
    // A structural mock avoids requiring a browser or a native canvas package.
    drawPixelIcon(ctx as unknown as CanvasRenderingContext2D, first, 7, 11, 3, '#abcdef');
    expect(ctx.fillStyle).toBe('#abcdef');
    const expected = [...iconPath(first).matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)].map((match) => [
      7 + Number(match[1]) * 3, 11 + Number(match[2]) * 3, Number(match[3]) * 3, 3,
    ]);
    expect(fillRect.mock.calls).toEqual(expected);
    for (const call of fillRect.mock.calls) expect(call.every(Number.isInteger)).toBe(true);
  });
});
