import type { LcdRenderOptions } from '../lcd/renderer';
import type { SimulationConfig } from '../lcd/model';

export type CompositionText = { quote: string; person: string; role: string; game: string };
export type CompositionSettings = {
  layout: { arrangement?: 'Split' | 'Reversed' | 'Banner'; split: number; margin: number; gutter: number; bubbleHeight: number; tailX: number; attribution: 'Nameplate' | 'In bubble'; titleHeight: number };
  portrait: { zoom: number; x: number; y: number; flip: boolean };
  gameplay: { width: number; aspect: number; zoom: number; x: number; y: number; pixelFrame: boolean };
  typography: { quoteSize: number; gameSize: number; nameSize: number; panelDepth: number };
  screen: Omit<LcdRenderOptions, 'motif' | 'motifScale'>;
  simulation: SimulationConfig;
};
export type CompositionAssets = { portrait: CanvasImageSource | null; gameplay: CanvasImageSource | null };
export type Rect = { x: number; y: number; width: number; height: number };
