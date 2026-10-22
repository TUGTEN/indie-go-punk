import type { CompositionSettings } from './types';

type CompositionLayoutPreset = {
  id: string;
  name: string;
  description: string;
  values: {
    layout: Partial<CompositionSettings['layout']>;
    gameplay?: Partial<CompositionSettings['gameplay']>;
    typography?: Partial<CompositionSettings['typography']>;
  };
};

export const compositionLayouts: CompositionLayoutPreset[] = [
  {
    id: 'interview-split', name: 'Interview Split', description: 'Portrait and quote left, gameplay right.',
    values: { layout: { arrangement: 'Split', split: 0.47, bubbleHeight: 220, titleHeight: 168 }, typography: { quoteSize: 5 } },
  },
  {
    id: 'reverse-split', name: 'Reverse split', description: 'Portrait and quote right, gameplay left.',
    values: { layout: { arrangement: 'Reversed', split: 0.47, bubbleHeight: 220, titleHeight: 168 }, typography: { quoteSize: 5 } },
  },
  {
    id: 'quote-banner', name: 'Quote banner', description: 'A full-width quote above the portrait and gameplay.',
    values: { layout: { arrangement: 'Banner', split: 0.47, bubbleHeight: 180, titleHeight: 144 }, typography: { quoteSize: 7 } },
  },
  {
    id: 'game-first', name: 'Game first', description: 'A smaller portrait column gives the game more room.',
    values: { layout: { arrangement: 'Split', split: 0.38, bubbleHeight: 180, titleHeight: 128 }, typography: { quoteSize: 5 } },
  },
];
