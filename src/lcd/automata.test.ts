import { describe, expect, it } from 'vitest';
import {
  seedLife, stepLife, seedElementary, stepElementary, seedCyclic, stepCyclic,
  type Field,
} from './automata';

function field(rows: string[], states = 2): Field {
  return {
    width: rows[0]!.length, height: rows.length,
    cells: Uint8Array.from(rows.join(''), Number), states, generation: 0,
  };
}

function rows(value: Field): string[] {
  return Array.from({ length: value.height }, (_, y) =>
    Array.from(value.cells.slice(y * value.width, (y + 1) * value.width)).join(''));
}

describe('Life', () => {
  it('oscillates a blinker synchronously', () => {
    const start = field(['00000', '00000', '01110', '00000', '00000']);
    const next = stepLife(start, false);
    expect(rows(next)).toEqual(['00000', '00100', '00100', '00100', '00000']);
    expect(stepLife(next, false).cells).toEqual(start.cells);
  });

  it('preserves a block and kills isolated or overcrowded cells', () => {
    const block = field(['0000', '0110', '0110', '0000']);
    expect(stepLife(block, false).cells).toEqual(block.cells);
    expect(rows(stepLife(field(['000', '010', '000']), false))).toEqual(['000', '000', '000']);
    expect(stepLife(field(['111', '111', '111']), false).cells[4]).toBe(0);
  });

  it('moves a glider one cell diagonally after four steps', () => {
    let current = field(['000000', '001000', '000100', '011100', '000000', '000000']);
    for (let n = 0; n < 4; n++) current = stepLife(current, false);
    expect(rows(current)).toEqual(['000000', '000000', '000100', '000010', '001110', '000000']);
    expect(current.generation).toBe(4);
  });

  it('wraps across edges only when requested', () => {
    const start = field(['00000', '10000', '10000', '10000', '00000']);
    expect(rows(stepLife(start, true))).toEqual(['00000', '00000', '11001', '00000', '00000']);
    expect(rows(stepLife(start, false))).toEqual(['00000', '00000', '11000', '00000', '00000']);
  });

  it('honors density endpoints', () => {
    expect([...seedLife(8, 8, 42, 0).cells].every(x => x === 0)).toBe(true);
    expect([...seedLife(8, 8, 42, 1).cells].every(x => x === 1)).toBe(true);
  });
});

describe('elementary', () => {
  it.each([
    [0, ['0001000', '0000000', '0000000', '0000000']],
    [255, ['0001000', '1111111', '1111111', '1111111']],
    [90, ['0001000', '0010100', '0100010', '1010101']],
    [30, ['0001000', '0011100', '0110010', '1101111']],
  ] as const)('builds exact rule %i history', (rule, expected) => {
    expect(rows(seedElementary(7, 4, 123, rule, false))).toEqual(expected);
  });

  it('scrolls exactly one row and applies rule bits to the bottom row', () => {
    const start = field(['00000', '10000']);
    expect(rows(stepElementary(start, 90, false))).toEqual(['10000', '01000']);
    expect(rows(stepElementary(start, 90, true))).toEqual(['10000', '01001']);
    expect(rows(stepElementary(field(['1']), 0, true))).toEqual(['0']);
    expect(rows(stepElementary(field(['0']), 255, false))).toEqual(['1']);
  });
});

describe('cyclic', () => {
  it('advances only for the next state and sufficient eight-neighbor count', () => {
    const start = field(['110', '002', '000'], 3);
    expect(stepCyclic(start, false, 2).cells[4]).toBe(1);
    expect(stepCyclic(start, false, 3).cells[4]).toBe(0);
    expect(stepCyclic(field(['222', '202', '222'], 3), false, 1).cells[4]).toBe(0);
    expect(stepCyclic(field(['000', '020', '000'], 3), false, 8).cells[4]).toBe(0);
  });

  it('wraps neighbors without treating absent neighbors as state zero', () => {
    const start = field(['0000', '0000', '0000', '0001'], 3);
    expect(stepCyclic(start, false, 1).cells[0]).toBe(0);
    expect(stepCyclic(start, true, 1).cells[0]).toBe(1);
    expect(stepCyclic(field(['2'], 3), false, 1).cells[0]).toBe(2);
  });
});

describe('shared contracts', () => {
  const seeders = [
    (seed: number) => seedLife(32, 16, seed, 0.5),
    (seed: number) => seedElementary(32, 16, seed, 30, true),
    (seed: number) => seedCyclic(32, 16, seed, 16),
  ];

  it.each(seeders)('seeds reproducibly with independent storage', seed => {
    const first = seed(123);
    const same = seed(123);
    expect(first).toEqual(same);
    expect(first.cells).not.toBe(same.cells);
    expect(first.cells).not.toEqual(seed(124).cells);
    expect(first.generation).toBe(0);
    expect([...first.cells].every(cell => cell < first.states)).toBe(true);
    expect(new Set(first.cells).size).toBe(first.states);
  });

  it('does not mutate input fields or share output storage', () => {
    const cases: [Field, (input: Field) => Field][] = [
      [seedLife(8, 8, 1, 0.5), input => stepLife(input, true)],
      [seedElementary(8, 8, 1, 30, true), input => stepElementary(input, 90, true)],
      [seedCyclic(8, 8, 1, 3), input => stepCyclic(input, true, 2)],
    ];
    for (const [input, step] of cases) {
      const before = { ...input, cells: input.cells.slice() };
      Object.freeze(input);
      const output = step(input);
      expect(input).toEqual(before);
      expect(output).not.toBe(input);
      expect(output.cells).not.toBe(input.cells);
      expect(output.generation).toBe(1);
      expect(output.width).toBe(input.width);
      expect(output.height).toBe(input.height);
      expect(output.states).toBe(input.states);
    }
  });

  it.each([[0, 1], [1, 0], [-1, 2], [513, 1], [1, 257], [1.5, 1], [NaN, 1], [1, Infinity]])(
    'rejects invalid dimensions %s x %s', (width, height) => {
      expect(() => seedLife(width, height, 1, 0.5)).toThrow(RangeError);
      expect(() => seedElementary(width, height, 1, 30, false)).toThrow(RangeError);
      expect(() => seedCyclic(width, height, 1, 3)).toThrow(RangeError);
    },
  );

  it('supports minimum and maximum dimensions', () => {
    expect(seedLife(512, 256, 0, 0).cells.length).toBe(512 * 256);
    expect(seedElementary(1, 1, 0, 30, false).cells).toEqual(Uint8Array.of(1));
    expect(seedCyclic(1, 1, 0, 3).cells.length).toBe(1);
  });

  it('rejects invalid parameters and malformed fields', () => {
    for (const density of [-0.1, 1.1, NaN]) expect(() => seedLife(2, 2, 0, density)).toThrow(RangeError);
    for (const rule of [-1, 256, 0.5, NaN]) {
      expect(() => seedElementary(2, 2, 0, rule, false)).toThrow(RangeError);
      expect(() => stepElementary(field(['00']), rule, false)).toThrow(RangeError);
    }
    for (const states of [2, 17, 3.5, NaN]) expect(() => seedCyclic(2, 2, 0, states)).toThrow(RangeError);
    for (const threshold of [0, 9, 1.5, NaN]) {
      expect(() => stepCyclic(field(['00'], 3), false, threshold)).toThrow(RangeError);
    }
    for (const seed of seeders) expect(() => seed(Infinity)).toThrow(RangeError);
    expect(() => stepLife({ ...field(['00']), cells: Uint8Array.of(0) }, false)).toThrow(RangeError);
    expect(() => stepLife(field(['02']), false)).toThrow(RangeError);
    expect(() => stepCyclic(field(['03'], 3), false, 1)).toThrow(RangeError);
    expect(() => stepLife({ ...field(['00']), generation: -1 }, false)).toThrow(RangeError);
  });
});
