import { describe, expect, it } from 'vitest';
import { circuitField, circuitTiles, collapseTiles, type Collapse, type Tile } from './wfc';

const incompatible: Tile[] = [{ id: 'north', ports: [1, 0, 0, 0] }];
const alternating: Tile[] = [
  { id: 'a', ports: [1, 1, 0, 0] },
  { id: 'b', ports: [0, 0, 1, 1] },
];

function adjacency(result: Collapse, wrap: boolean, palette = circuitTiles): void {
  expect(result.status).toBe('complete');
  for (let y = 0; y < result.height; y++) {
    for (let x = 0; x < result.width; x++) {
      const tile = palette[result.tiles[y * result.width + x]!]!;
      expect(tile).toBeDefined();
      for (const [d, dx, dy] of [[0, 0, -1], [1, 1, 0], [2, 0, 1], [3, -1, 0]]) {
        let nx = x + dx!, ny = y + dy!;
        if (wrap) {
          nx = (nx + result.width) % result.width;
          ny = (ny + result.height) % result.height;
        } else if (nx < 0 || ny < 0 || nx >= result.width || ny >= result.height) continue;
        const neighbor = palette[result.tiles[ny * result.width + nx]!]!;
        expect(tile.ports[d!]).toBe(neighbor.ports[(d! + 2) % 4]);
      }
    }
  }
}

describe('wave function collapse', () => {
  it('is deterministic, seed-sensitive and does not mutate inputs', () => {
    const tiles = structuredClone(circuitTiles);
    const before = structuredClone(tiles);
    const a = collapseTiles(12, 8, 23, { tiles });
    expect(collapseTiles(12, 8, 23, { tiles })).toEqual(a);
    expect(collapseTiles(12, 8, 24).tiles).not.toEqual(a.tiles);
    expect(tiles).toEqual(before);
    expect(a.attempts).toBe(1);
    expect(a.decisions).toBeGreaterThan(0);
  });

  it('satisfies every port on ordinary and tiny periodic grids across seeds', () => {
    for (const wrap of [false, true]) {
      for (const [width, height] of [[1, 1], [1, 7], [8, 1], [2, 2], [9, 6]]) {
        for (let seed = 0; seed < 12; seed++) {
          adjacency(collapseTiles(width!, height!, seed, { wrap }), wrap);
        }
      }
    }
  });

  it('allows exposed outside ports, but propagates initial singletons and self constraints', () => {
    const open = collapseTiles(1, 1, 0, { tiles: incompatible });
    expect(open.status).toBe('complete');
    expect(open.decisions).toBe(0);
    const adjacent = collapseTiles(1, 2, 0, { tiles: incompatible });
    expect(adjacent.status).toBe('contradiction');
    expect([...adjacent.tiles]).toContain(-1);
    const periodic = collapseTiles(1, 1, 0, { tiles: incompatible, wrap: true, attempts: 2 });
    expect(periodic).toMatchObject({ status: 'contradiction', attempts: 2, decisions: 0 });
    expect([...periodic.tiles]).toEqual([-1]);
  });

  it('filters incompatible self tiles even when different tiles offer apparent support', () => {
    const result = collapseTiles(1, 1, 0, { tiles: alternating, wrap: true });
    expect(result.status).toBe('contradiction');
    expect(result.decisions).toBe(0);
    expect(result.attempts).toBe(4);
  });

  it('performs bounded retries after genuine propagation contradictions', () => {
    for (const attempts of [1, 2, 4]) {
      const result = collapseTiles(3, 3, 42, { tiles: alternating, wrap: true, attempts });
      expect(result.status).toBe('contradiction');
      expect(result.attempts).toBe(attempts);
      expect(result.decisions).toBe(attempts);
      expect([...result.tiles]).toContain(-1);
      expect(() => circuitField(result)).toThrow(/contradiction/);
    }
    adjacency(collapseTiles(4, 4, 42, { tiles: alternating, wrap: true }), true, alternating);
  });

  it('terminates at the maximum dimensions', () => {
    const result = collapseTiles(64, 40, -1, { wrap: true });
    adjacency(result, true);
    const raster = circuitField(result);
    expect([raster.width, raster.height, raster.cells.length]).toEqual([320, 200, 64000]);
    expect(result.decisions).toBeLessThanOrEqual(64 * 40 * 4);
  });

  it('rejects invalid dimensions, seeds, options and malformed palettes', () => {
    for (const [w, h] of [[0, 1], [65, 1], [1, 41], [1.5, 1], [NaN, 1], [1, Infinity]]) {
      expect(() => collapseTiles(w!, h!, 0)).toThrow();
    }
    for (const seed of [NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => collapseTiles(1, 1, seed)).toThrow();
    }
    for (const attempts of [0, 5, 1.5, NaN]) {
      expect(() => collapseTiles(1, 1, 0, { attempts })).toThrow();
    }
    for (const tiles of [[], Array(257).fill(circuitTiles[0]),
      [{ id: '', ports: [0, 0, 0, 0] }],
      [{ id: 'bad', ports: [0, 2, 0, 0] }],
      [{ id: 'bad', ports: [0, 0, 0] }],
      [circuitTiles[0], circuitTiles[0]],
    ]) {
      // Deliberately malformed runtime input, not a partial production fixture.
      expect(() => collapseTiles(1, 1, 0, { tiles: tiles as Tile[] })).toThrow();
    }
    expect(() => collapseTiles(1, 1, 0, { wrap: 'yes' as unknown as boolean })).toThrow();
  });
});

describe('circuit raster', () => {
  it('draws exactly center-to-edge paths for every default tile, leaving blank empty', () => {
    circuitTiles.forEach((tile, t) => {
      const result: Collapse = {
        width: 1, height: 1, tiles: new Int16Array([t]),
        status: 'complete', attempts: 1, decisions: 7,
      };
      const field = circuitField(result);
      const expected = new Uint8Array(25);
      for (let d = 0; d < 4; d++) {
        if (!tile.ports[d]) continue;
        const dx = [0, 1, 0, -1][d]!, dy = [-1, 0, 1, 0][d]!;
        for (let step = 0; step <= 2; step++) expected[(2 + dy * step) * 5 + 2 + dx * step] = 1;
      }
      expect(field.cells).toEqual(expected);
      expect(field.states).toBe(2);
      expect(field.generation).toBe(7);
      expect([...result.tiles]).toEqual([t]);
      expect(circuitField(result).cells).not.toBe(field.cells);
    });
  });

  it('preserves inter-tile connectivity and does not mutate the collapse', () => {
    const result = collapseTiles(10, 8, 17);
    const before = result.tiles.slice();
    const field = circuitField(result);
    for (let y = 0; y < result.height; y++) {
      for (let x = 0; x < result.width; x++) {
        const cx = x * 5 + 2, cy = y * 5 + 2;
        if (x + 1 < result.width) {
          expect(field.cells[cy * field.width + cx + 2]).toBe(field.cells[cy * field.width + cx + 3]);
        }
        if (y + 1 < result.height) {
          expect(field.cells[(cy + 2) * field.width + cx]).toBe(field.cells[(cy + 3) * field.width + cx]);
        }
      }
    }
    expect(result.tiles).toEqual(before);
  });

  it('snapshots custom palettes for returned collapses', () => {
    const tile: Tile = { id: 'horizontal', ports: [0, 1, 0, 1] };
    const result = collapseTiles(2, 1, 0, { tiles: [tile] });
    tile.ports = [0, 0, 0, 0];
    expect([...circuitField(result).cells].reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('rejects incomplete or malformed results', () => {
    const result = collapseTiles(1, 1, 1);
    expect(() => circuitField({ ...result, tiles: new Int16Array([-1]) })).toThrow();
    expect(() => circuitField({ ...result, tiles: new Int16Array([99]) })).toThrow();
    expect(() => circuitField({ ...result, tiles: new Int16Array(0) })).toThrow();
    expect(() => circuitField({ ...result, decisions: -1 })).toThrow();
  });
});
