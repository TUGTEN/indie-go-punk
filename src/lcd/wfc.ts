import type { Field } from './automata';

/** Ports are ordered north, east, south, west; 0 closed, 1 open. */
export type Tile = { id: string; ports: readonly [number, number, number, number] };

export const circuitTiles: readonly Tile[] = [
  { id: 'blank', ports: [0, 0, 0, 0] },
  { id: 'straightNS', ports: [1, 0, 1, 0] },
  { id: 'straightEW', ports: [0, 1, 0, 1] },
  { id: 'bendNE', ports: [1, 1, 0, 0] },
  { id: 'bendES', ports: [0, 1, 1, 0] },
  { id: 'bendSW', ports: [0, 0, 1, 1] },
  { id: 'bendWN', ports: [1, 0, 0, 1] },
  { id: 'teeNES', ports: [1, 1, 1, 0] },
  { id: 'teeESW', ports: [0, 1, 1, 1] },
  { id: 'teeSWN', ports: [1, 0, 1, 1] },
  { id: 'teeWNE', ports: [1, 1, 0, 1] },
  { id: 'cross', ports: [1, 1, 1, 1] },
];

export type Collapse = {
  width: number;
  height: number;
  tiles: Int16Array;
  status: 'complete' | 'contradiction';
  attempts: number;
  decisions: number;
};

// Preserve custom palettes without extending the public result shape. Snapshotting
// prevents subsequent caller edits to a tile definition from changing its raster.
const palettes = new WeakMap<Collapse, readonly Tile[]>();

function integer(value: number, min: number, max: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in ${min}..${max}`);
  }
}

function dimensions(width: number, height: number): void {
  integer(width, 1, 64, 'width');
  integer(height, 1, 40, 'height');
}

function paletteSnapshot(tiles: readonly Tile[]): Tile[] {
  if (!Array.isArray(tiles)) throw new TypeError('tiles must be an array');
  integer(tiles.length, 1, 256, 'tile count');
  const ids = new Set<string>();
  return Array.from(tiles, tile => {
    if (!tile || typeof tile.id !== 'string' || !tile.id.length || ids.has(tile.id)) {
      throw new TypeError('tile ids must be nonempty and unique');
    }
    ids.add(tile.id);
    if (!Array.isArray(tile.ports) || tile.ports.length !== 4 ||
        ![0, 1, 2, 3].every(d => tile.ports[d] === 0 || tile.ports[d] === 1)) {
      throw new TypeError('tiles require four binary ports');
    }
    return { id: tile.id, ports: [tile.ports[0], tile.ports[1], tile.ports[2], tile.ports[3]] };
  });
}

export function collapseTiles(
  width: number, height: number, seed: number,
  options: { tiles?: readonly Tile[]; wrap?: boolean; attempts?: number } = {},
): Collapse {
  dimensions(width, height);
  integer(seed, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 'seed');
  if (!options || typeof options !== 'object') throw new TypeError('options must be an object');
  if (options.wrap !== undefined && typeof options.wrap !== 'boolean') {
    throw new TypeError('wrap must be boolean');
  }
  const limit = options.attempts === undefined ? 4 : options.attempts;
  integer(limit, 1, 4, 'attempts');
  const palette = paletteSnapshot(options.tiles === undefined ? circuitTiles : options.tiles);
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const size = width * height;
  const neighbors = Array.from({ length: size }, (_, i) => {
    const x = i % width, y = Math.floor(i / width);
    return [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]].map(([nx, ny]) => {
      if (options.wrap) return ((ny! + height) % height) * width + (nx! + width) % width;
      return nx! < 0 || nx! >= width || ny! < 0 || ny! >= height ? -1 : ny! * width + nx!;
    });
  });
  let decisions = 0;
  for (let attempt = 1; attempt <= limit; attempt++) {
    const domains = Array.from({ length: size }, () => palette.map((_, t) => t));
    const queue = Array.from({ length: size }, (_, i) => i);
    const queued = new Uint8Array(size).fill(1);
    let head = 0;
    const enqueue = (i: number) => {
      if (!queued[i]) { queued[i] = 1; queue.push(i); }
    };
    // Every post-initial queue insertion follows a strict domain reduction;
    // deduplication bounds queue work by initial cells + valid removals.
    const propagate = (): boolean => {
      while (head < queue.length) {
        const i = queue[head++]!;
        queued[i] = 0;
        for (let d = 0; d < 4; d++) {
          const j = neighbors[i]![d]!;
          if (j < 0) continue;
          const opposite = (d + 2) % 4;
          const supported = new Set(domains[i]!.map(t => palette[t]!.ports[d]));
          const next = domains[j]!.filter(t => j === i
            ? palette[t]!.ports[d] === palette[t]!.ports[opposite]
            : supported.has(palette[t]!.ports[opposite]));
          if (next.length !== domains[j]!.length) {
            domains[j] = next;
            if (!next.length) return false;
            enqueue(j);
          }
        }
      }
      return true;
    };
    let valid = propagate();
    while (valid) {
      let entropy = Infinity;
      const ties: number[] = [];
      for (let i = 0; i < size; i++) {
        const count = domains[i]!.length;
        if (count <= 1 || count > entropy) continue;
        if (count < entropy) { entropy = count; ties.length = 0; }
        ties.push(i);
      }
      if (!ties.length) break;
      const i = ties[Math.floor(random() * ties.length)]!;
      const domain = domains[i]!;
      domains[i] = [domain[Math.floor(random() * domain.length)]!];
      decisions++;
      enqueue(i);
      valid = propagate();
    }
    if (valid || attempt === limit) {
      const result: Collapse = {
        width, height,
        tiles: Int16Array.from(domains, domain => domain.length === 1 ? domain[0]! : -1),
        status: valid ? 'complete' : 'contradiction', attempts: attempt, decisions,
      };
      palettes.set(result, palette);
      return result;
    }
  }
  throw new Error('unreachable attempt limit');
}

/** Rasterize a returned collapse (custom palettes are retained by result identity).
 * Structurally constructed/copied results use the default circuit palette.
 */
export function circuitField(result: Collapse): Field {
  dimensions(result.width, result.height);
  if (result.status !== 'complete') throw new Error('cannot rasterize a contradiction');
  integer(result.decisions, 0, Number.MAX_SAFE_INTEGER, 'decisions');
  integer(result.attempts, 1, 4, 'attempts');
  if (!(result.tiles instanceof Int16Array) || result.tiles.length !== result.width * result.height) {
    throw new RangeError('tiles must be an Int16Array matching dimensions');
  }
  const palette = palettes.get(result) ?? circuitTiles;
  const width = result.width * 5, height = result.height * 5;
  const cells = new Uint8Array(width * height);
  const dx = [0, 1, 0, -1], dy = [-1, 0, 1, 0];
  result.tiles.forEach((t, i) => {
    integer(t, 0, palette.length - 1, 'tile index');
    const ports = palette[t]!.ports;
    const x = (i % result.width) * 5 + 2;
    const y = Math.floor(i / result.width) * 5 + 2;
    for (let d = 0; d < 4; d++) {
      if (ports[d] === 1) {
        for (let step = 0; step <= 2; step++) {
          cells[(y + dy[d]! * step) * width + x + dx[d]! * step] = 1;
        }
      }
    }
  });
  return { width, height, cells, states: 2, generation: result.decisions };
}
