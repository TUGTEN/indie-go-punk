import { describe, expect, it } from 'vitest';
import { algorithms, createArtwork, advanceField, nextSeed, type SimulationConfig } from './model';
const defaults: SimulationConfig = { algorithm: 'Game of Life', width: 80, height: 45, density: 0.32, rule: 90, randomStart: false, states: 8, threshold: 1, wrap: true, settle: 12 };
describe('LCD artwork model', () => {
  it.each(algorithms)('%s produces reproducible dimensions without mutation', algorithm => {
    const config = { ...defaults, algorithm };
    const one = createArtwork(config, 41); const two = createArtwork(config, 41);
    expect(one.field).toEqual(two.field);
    expect(one.field?.cells.length).toBe(80 * 45);
    expect(one.field?.width).toBe(80); expect(one.field?.height).toBe(45);
    const before = one.field!.cells.slice(); advanceField(one.field!, config);
    expect(one.field!.cells).toEqual(before);
  });
  it('reset reproduces initial settled Life, while a step advances it', () => {
    const start = createArtwork(defaults, 2).field!;
    expect(start.generation).toBe(12);
    expect(advanceField(start, defaults).generation).toBe(13);
    expect(createArtwork(defaults, 2).field).toEqual(start);
  });
  it('a fixed elementary start is independent of seed and starts with history', () => {
    const config = { ...defaults, algorithm: 'Elementary CA' as const };
    expect(createArtwork(config, 1).field).toEqual(createArtwork(config, 2).field);
    const initial = createArtwork(config, 1).field!;
    expect(initial.generation).toBe(0);
    expect(advanceField(initial, config).cells).not.toEqual(initial.cells);
    expect(createArtwork({ ...config, randomStart: true }, 1).field).not.toEqual(createArtwork({ ...config, randomStart: true }, 2).field);
  });
  it('WFC is static rather than pretending to simulate', () => {
    const config = { ...defaults, algorithm: 'WFC circuits' as const };
    const field = createArtwork(config, 41).field!;
    expect(advanceField(field, config)).toBe(field);
    expect(() => createArtwork({ ...config, width: 81 }, 41)).toThrow(/multiples/);
  });
  it('settle is bounded and seed increment wraps uint32', () => {
    expect(() => createArtwork({ ...defaults, settle: 101 }, 41)).toThrow();
    expect(() => createArtwork({ ...defaults, settle: 0.5 }, 41)).toThrow();
    expect(nextSeed(4294967295)).toBe(0); expect(nextSeed(41)).toBe(42);
  });
});
