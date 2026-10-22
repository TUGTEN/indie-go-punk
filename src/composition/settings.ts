import type { DialConfig, ResolvedValues } from 'dialkit';
import { algorithms, type Algorithm } from '../lcd/model';
import type { CompositionSettings } from './types';
export const compositionControls = {
  layout: {
    arrangement: { type: 'select', options: ['Split', 'Reversed', 'Banner'], default: 'Split' },
    split: [0.47, 0.38, 0.56, 0.01], margin: [32, 16, 56, 4], gutter: [24, 12, 40, 4],
    bubbleHeight: [220, 140, 300, 4], tailX: [0.54, 0.2, 0.8, 0.02],
    attribution: { type: 'select', options: ['Nameplate', 'In bubble'], default: 'Nameplate' },
    titleHeight: [168, 96, 240, 4],
  },
  portrait: { zoom: [1, 0.5, 2.2, 0.05], x: [0, -160, 160, 4], y: [0, -120, 120, 4], flip: false },
  gameplay: { width: [1, 0.5, 1, 0.02], aspect: [1.78, 0.75, 2.4, 0.01], zoom: [1, 1, 3, 0.05], x: [0, -100, 100, 2], y: [0, -100, 100, 2], pixelFrame: true as boolean },
  typography: { quoteSize: [5, 2, 9, 1], gameSize: [7, 2, 12, 1], nameSize: [3, 2, 6, 1], panelDepth: [1, 0, 2, 0.1] },
  screen: {
    paper: '#6f975d', ink: '#203f24',
    surface: { type: 'select', options: ['Flat', 'LCD', 'Backlit'], default: 'LCD' },
    tones: { type: 'select', options: ['Two tone', 'Shaded'], default: 'Shaded' },
    depth: [1, 0, 2, 0.05], glow: [0.45, 0, 1, 0.05], gap: [0.12, 0, 0.45, 0.01], threshold: [0.5, 0.05, 0.95, 0.05], invert: false,
  },
  simulation: {
    algorithm: { type: 'select', options: [...algorithms], default: 'Cyclic CA' },
    density: [0.32, 0.05, 0.8, 0.01], rule: [90, 0, 255, 1], randomStart: false,
    states: [8, 3, 16, 1], threshold: [1, 1, 8, 1], wrap: true, settle: [36, 0, 100, 1],
  },
} satisfies DialConfig;
export function compositionSettings(v: ResolvedValues<typeof compositionControls>): CompositionSettings {
  return {
    layout: { ...v.layout, arrangement: v.layout.arrangement as CompositionSettings['layout']['arrangement'], attribution: v.layout.attribution as CompositionSettings['layout']['attribution'] },
    portrait: v.portrait, gameplay: v.gameplay, typography: v.typography,
    screen: { ...v.screen, surface: v.screen.surface as CompositionSettings['screen']['surface'], tones: v.screen.tones as CompositionSettings['screen']['tones'] },
    simulation: { ...v.simulation, algorithm: v.simulation.algorithm as Algorithm, width: 160, height: 90 },
  };
}
export { screenPalettes as compositionPalettes } from '../palettes';
