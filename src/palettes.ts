/** Shared screen/pixel inks. Reference schemes deliberately preserve muted contrast. */
export type ScreenPalette = {
  id: string; name: string; paper: string; ink: string; surface: 'Flat' | 'LCD' | 'Backlit';
};
export const screenPalettes: readonly ScreenPalette[] = [
  { id: 'lcd-green', name: 'LCD green', paper: '#477e43', ink: '#2d612d', surface: 'LCD' },
  { id: 'readable-green', name: 'Readable green', paper: '#6f975d', ink: '#203f24', surface: 'LCD' },
  { id: 'reference-green', name: 'Reference green', paper: '#477e43', ink: '#234725', surface: 'LCD' },
  { id: 'amber', name: 'Flipper amber', paper: '#f6a52b', ink: '#30230f', surface: 'Backlit' },
  { id: 'pocket-blue', name: 'Pocket blue', paper: '#91c7d0', ink: '#163d53', surface: 'LCD' },
  { id: 'violet', name: 'Violet LCD', paper: '#7a2d8d', ink: '#601b70', surface: 'LCD' },
  { id: 'violet-chalk', name: 'Violet / chalk', paper: '#c4afd3', ink: '#4e1c60', surface: 'LCD' },
  { id: 'neon-cyan', name: 'Neon cyan', paper: '#101526', ink: '#39ffe0', surface: 'Flat' },
  { id: 'neon-pink', name: 'Neon pink', paper: '#1c1027', ink: '#ff59dc', surface: 'Flat' },
  { id: 'neon-lime', name: 'Neon lime', paper: '#172012', ink: '#c2ff4b', surface: 'Flat' },
  { id: 'red-chalk', name: 'Red / chalk', paper: '#efedeb', ink: '#b32638', surface: 'Flat' },
  { id: 'red-screen', name: 'Red screen', paper: '#9c2639', ink: '#f2efef', surface: 'LCD' },
  { id: 'paper', name: 'Paper', paper: '#f2efdf', ink: '#292e25', surface: 'Flat' },
  { id: 'black-white', name: 'Black / white', paper: '#ffffff', ink: '#000000', surface: 'Flat' },
  { id: 'inverted', name: 'Inverted', paper: '#000000', ink: '#ffffff', surface: 'Flat' },
];
