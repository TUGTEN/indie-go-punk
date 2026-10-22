import { seedLife, seedElementary, seedCyclic, stepLife, stepElementary, stepCyclic, type Field } from './automata';
import { collapseTiles, circuitField } from './wfc';

export const algorithms = ['Game of Life', 'Elementary CA', 'Cyclic CA', 'WFC circuits'] as const;
export type Algorithm = typeof algorithms[number];
export type SimulationConfig = {
  algorithm: Algorithm; width: number; height: number; density: number;
  rule: number; randomStart: boolean; states: number; threshold: number;
  wrap: boolean; settle: number;
};
export type Artwork = { field: Field | null; description: string };
export function advanceField(field: Field, config: SimulationConfig): Field {
  switch (config.algorithm) {
    case 'Game of Life': return stepLife(field, config.wrap);
    case 'Elementary CA': return stepElementary(field, config.rule, config.wrap);
    case 'Cyclic CA': return stepCyclic(field, config.wrap, config.threshold);
    case 'WFC circuits': return field;
    default: throw new Error('Unknown algorithm');
  }
}
export function createArtwork(config: SimulationConfig, seed: number): Artwork {
  if (!Number.isInteger(config.settle) || config.settle < 0 || config.settle > 100) throw new RangeError('Settle must be 0–100 steps');
  if (config.algorithm === 'WFC circuits') {
    if (config.width % 5 || config.height % 5) throw new RangeError('Circuit dimensions must be multiples of five');
    const result = collapseTiles(config.width / 5, config.height / 5, seed, { wrap: config.wrap, attempts: 4 });
    if (result.status === 'contradiction') return { field: null, description: `Contradiction after ${result.attempts} attempts. Try another seed.` };
    return { field: circuitField(result), description: `Collapsed ${result.width} × ${result.height} tiles · ${result.decisions} decisions · matching edge ports` };
  }
  let field: Field;
  switch (config.algorithm) {
    case 'Game of Life': field = seedLife(config.width, config.height, seed, config.density); break;
    case 'Elementary CA': field = seedElementary(config.width, config.height, seed, config.rule, config.randomStart); break;
    case 'Cyclic CA': field = seedCyclic(config.width, config.height, seed, config.states); break;
    default: throw new Error('Unknown algorithm');
  }
  if (config.algorithm !== 'Elementary CA') for (let i = 0; i < config.settle; i++) field = advanceField(field, config);
  return { field, description: config.algorithm === 'Game of Life' ? 'Conway B3/S23 · eight-neighbor field' : config.algorithm === 'Elementary CA' ? `Rule ${config.rule} · newest history row at the bottom` : `${config.states} cyclic states · advance when ${config.threshold} neighbors show the next state` };
}
export function nextSeed(seed: number): number { return (seed + 1) >>> 0; }
