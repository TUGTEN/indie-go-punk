export type Field = {
  width: number;
  height: number;
  cells: Uint8Array;
  states: number;
  generation: number;
};

function integer(value: number, min: number, max: number, name: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in ${min}..${max}`);
  }
}

function dimensions(width: number, height: number): void {
  integer(width, 1, 512, 'width');
  integer(height, 1, 256, 'height');
}

function random(seed: number): () => number {
  if (!Number.isFinite(seed)) throw new RangeError('seed must be finite');
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function validate(field: Field, binary = false): void {
  dimensions(field.width, field.height);
  integer(field.states, binary ? 2 : 3, binary ? 2 : 16, 'states');
  integer(field.generation, 0, Number.MAX_SAFE_INTEGER - 1, 'generation');
  if (!(field.cells instanceof Uint8Array) || field.cells.length !== field.width * field.height) {
    throw new RangeError('cells must be a Uint8Array matching the dimensions');
  }
  for (const cell of field.cells) {
    if (cell >= field.states) throw new RangeError('cell exceeds state range');
  }
}

function sample(field: Field, x: number, y: number, wrap: boolean): number {
  if (wrap) {
    x = (x + field.width) % field.width;
    y = (y + field.height) % field.height;
  } else if (x < 0 || x >= field.width || y < 0 || y >= field.height) {
    return -1;
  }
  return field.cells[y * field.width + x]!;
}

export function seedLife(width: number, height: number, seed: number, density: number): Field {
  dimensions(width, height);
  if (!Number.isFinite(density) || density < 0 || density > 1) {
    throw new RangeError('density must be in 0..1');
  }
  const rng = random(seed);
  const cells = Uint8Array.from({ length: width * height }, () => Number(rng() < density));
  return { width, height, cells, states: 2, generation: 0 };
}

export function stepLife(field: Field, wrap: boolean): Field {
  validate(field, true);
  const cells = new Uint8Array(field.cells.length);
  for (let y = 0; y < field.height; y++) {
    for (let x = 0; x < field.width; x++) {
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx !== 0 || dy !== 0) count += Number(sample(field, x + dx, y + dy, wrap) === 1);
        }
      }
      const index = y * field.width + x;
      cells[index] = Number(count === 3 || (field.cells[index] === 1 && count === 2));
    }
  }
  return { ...field, cells, generation: field.generation + 1 };
}

function nextRow(row: Uint8Array, rule: number, wrap: boolean): Uint8Array {
  const width = row.length;
  const result = new Uint8Array(width);
  for (let x = 0; x < width; x++) {
    const left = x > 0 ? row[x - 1]! : wrap ? row[width - 1]! : 0;
    const right = x + 1 < width ? row[x + 1]! : wrap ? row[0]! : 0;
    const neighborhood = (left << 2) | (row[x]! << 1) | right;
    result[x] = (rule >>> neighborhood) & 1;
  }
  return result;
}

/** Seed history uses dead boundaries; generation counts steps after seeding. */
export function seedElementary(
  width: number, height: number, seed: number, rule: number, randomStart: boolean,
): Field {
  dimensions(width, height);
  integer(rule, 0, 255, 'rule');
  const rng = random(seed);
  const cells = new Uint8Array(width * height);
  if (randomStart) {
    for (let x = 0; x < width; x++) cells[x] = Number(rng() < 0.5);
  } else {
    cells[Math.floor(width / 2)] = 1;
  }
  for (let y = 1; y < height; y++) {
    cells.set(nextRow(cells.subarray((y - 1) * width, y * width), rule, false), y * width);
  }
  return { width, height, cells, states: 2, generation: 0 };
}

export function stepElementary(field: Field, rule: number, wrap: boolean): Field {
  validate(field, true);
  integer(rule, 0, 255, 'rule');
  const cells = new Uint8Array(field.cells.length);
  cells.set(field.cells.subarray(field.width));
  cells.set(nextRow(field.cells.subarray(-field.width), rule, wrap), cells.length - field.width);
  return { ...field, cells, generation: field.generation + 1 };
}

export function seedCyclic(width: number, height: number, seed: number, states: number): Field {
  dimensions(width, height);
  integer(states, 3, 16, 'states');
  const rng = random(seed);
  const cells = Uint8Array.from({ length: width * height }, () => Math.floor(rng() * states));
  return { width, height, cells, states, generation: 0 };
}

/** Wrapped neighborhoods count eight directional slots, even on very small grids. */
export function stepCyclic(field: Field, wrap: boolean, threshold: number): Field {
  validate(field);
  integer(threshold, 1, 8, 'threshold');
  const cells = field.cells.slice();
  for (let y = 0; y < field.height; y++) {
    for (let x = 0; x < field.width; x++) {
      const index = y * field.width + x;
      const next = (field.cells[index]! + 1) % field.states;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx !== 0 || dy !== 0) count += Number(sample(field, x + dx, y + dy, wrap) === next);
        }
      }
      if (count >= threshold) cells[index] = next;
    }
  }
  return { ...field, cells, generation: field.generation + 1 };
}
