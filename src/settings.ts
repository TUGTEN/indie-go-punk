import type { DialConfig, ResolvedValues } from 'dialkit';

export const controls = {
  cutout: {
    quality: { type: 'select', options: ['High quality', 'Fast'], default: 'High quality' },
    keepMain: true,
    trim: [0.5, 0, 4, 0.1],
    feather: [0.3, 0, 3, 0.1],
    cutoff: [12, 0, 100, 1],
    recut: { type: 'action', label: 'Re-cut original image' },
  },
  recovery: {
    _collapsed: true,
    exposure: [0, -1.5, 2, 0.05],
    shadows: [0, 0, 100, 1],
    localContrast: [0, 0, 100, 1],
    sharpen: [0, 0, 100, 1],
    denoise: [0, 0, 100, 1],
  },
  portrait: {
    _collapsed: true,
    flip: false as boolean,
    zoom: [0.86, 0.3, 1.8, 0.01],
    horizontal: [0, -70, 70, 1],
    vertical: [0, -70, 70, 1],
    cropBottom: [0, 0, 75, 1],
    maskThreshold: [100, 16, 240, 1],
  },
  treatment: {
    _collapsed: true,
    style: { type: 'select', options: ['Photo', 'Duotone', 'Halftone', 'Dither', 'Newsprint'], default: 'Photo' },
    contrast: [1.12, 0.5, 2, 0.01],
    brightness: [0, -50, 50, 1],
    saturation: [0.82, 0, 1.8, 0.01],
    warmth: [12, -40, 40, 1],
    grain: [10, 0, 45, 1],
    halftoneSize: [5, 1, 24, 1],
    ditherPixelSize: [2, 1, 16, 1],
    stippleSize: [1.2, 0.5, 6, 0.1],
    inkDensity: [50, 0, 100, 1],
    printGamma: [0.65, 0.35, 1.5, 0.05],
    screenStrength: [0.6, 0, 1, 0.01],
    ink: '#252b25',
    highlight: '#f2ead7',
  },
  border: {
    style: { type: 'select', options: ['Pixel', 'Sticker', 'Sketch', 'None'], default: 'Pixel' },
    color: '#f2ecd9',
    width: [12, 0, 40, 1],
    pixelSize: [10, 3, 32, 1],
    roughness: [4, 0, 12, 1],
    sketchStroke: [2.2, 0.5, 20, 0.1],
    shadow: [0.12, 0, 0.6, 0.01],
  },
  background: {
    color: '#315b43',
    texture: { type: 'select', options: ['Paper', 'Noise', 'Grunge', 'None'], default: 'Paper' },
    strength: [14, 0, 50, 1],
    scale: [1.5, 0.5, 5, 0.1],
    grungeInk: '#d0338f',
    patchSize: [140, 30, 400, 5],
    coverage: [0.45, 0, 1, 0.01],
    distress: [0.3, 0, 1, 0.01],
    edgeBias: [0.8, 0, 1, 0.01],
    vignette: [0.08, 0, 0.5, 0.01],
    transparent: false as boolean,
  },
} satisfies DialConfig;

export type Settings = ResolvedValues<typeof controls>;
export type Preset = {
  id: string;
  name: string;
  description: string;
  swatch: string;
  values: {
    treatment: Partial<Settings['treatment']>;
    border: Partial<Settings['border']>;
    background: Partial<Settings['background']>;
  };
};

export const presets: Preset[] = [
  {
    id: 'collage', name: 'Field notes', description: 'Warm photo / pixel edge', swatch: '#315b43',
    values: {
      treatment: { style: 'Photo', contrast: 1.12, brightness: 0, saturation: 0.82, warmth: 12, grain: 10, halftoneSize: 5, ditherPixelSize: 2, stippleSize: 1.2, inkDensity: 50, printGamma: 0.65, screenStrength: 0.6, ink: '#252b25', highlight: '#f2ead7' },
      border: { style: 'Pixel', color: '#f2ecd9', width: 12, pixelSize: 10, roughness: 4, sketchStroke: 2.2, shadow: 0.12 },
      background: { color: '#315b43', texture: 'Paper', strength: 14, scale: 1.5, vignette: 0.08, transparent: false },
    },
  },
  {
    id: 'xerox', name: 'Copy machine', description: 'Black ink / paper stock', swatch: '#e8e5d9',
    values: {
      treatment: { style: 'Halftone', contrast: 1.25, brightness: 8, saturation: 0, warmth: 0, grain: 4, halftoneSize: 5, ditherPixelSize: 2, stippleSize: 1.2, inkDensity: 50, printGamma: 0.65, screenStrength: 0.6, ink: '#252522', highlight: '#f2eedf' },
      border: { style: 'Pixel', color: '#d6d02e', width: 10, pixelSize: 8, roughness: 4, sketchStroke: 2.2, shadow: 0 },
      background: { color: '#eeebdf', texture: 'Paper', strength: 18, scale: 1.5, vignette: 0, transparent: false },
    },
  },
  {
    id: 'marker', name: 'Off the record', description: 'Soft color / rough marker', swatch: '#f3540b',
    values: {
      treatment: { style: 'Photo', contrast: 1.08, brightness: 4, saturation: 0.8, warmth: 6, grain: 6, halftoneSize: 5, ditherPixelSize: 2, stippleSize: 1.2, inkDensity: 50, printGamma: 0.65, screenStrength: 0.6, ink: '#252b25', highlight: '#f2ead7' },
      border: { style: 'Sketch', color: '#fff8e9', width: 5, pixelSize: 10, roughness: 5, sketchStroke: 2.2, shadow: 0 },
      background: { color: '#f3540b', texture: 'Noise', strength: 5, scale: 1, vignette: 0, transparent: false },
    },
  },
  {
    id: 'bitmap', name: 'Save state', description: 'Ordered dither / 8-bit edge', swatch: '#cbc976',
    values: {
      treatment: { style: 'Dither', contrast: 1.1, brightness: 8, saturation: 0, warmth: 0, grain: 0, halftoneSize: 5, ditherPixelSize: 2, stippleSize: 1.2, inkDensity: 50, printGamma: 0.65, screenStrength: 0.6, ink: '#253a2e', highlight: '#ece8ba' },
      border: { style: 'Pixel', color: '#253a2e', width: 12, pixelSize: 14, roughness: 4, sketchStroke: 2.2, shadow: 0 },
      background: { color: '#cbc976', texture: 'Paper', strength: 8, scale: 1.8, vignette: 0, transparent: false },
    },
  },
  {
    id: 'press', name: 'Street press', description: 'Grainy ink / cobalt + magenta', swatch: '#063b91',
    values: {
      treatment: { style: 'Newsprint', contrast: 1.5, brightness: 20, saturation: 0, warmth: 0, grain: 4, halftoneSize: 5, ditherPixelSize: 2, stippleSize: 1.2, inkDensity: 50, printGamma: 0.65, screenStrength: 0.6, ink: '#171a16', highlight: '#e9dfa7' },
      border: { style: 'None', color: '#e9dfa7', width: 5, pixelSize: 10, roughness: 4, sketchStroke: 2.2, shadow: 0 },
      background: { color: '#063b91', texture: 'Grunge', strength: 8, scale: 1, grungeInk: '#d0338f', patchSize: 110, coverage: 0.28, distress: 0.65, edgeBias: 0.8, vignette: 0, transparent: false },
    },
  },
];
