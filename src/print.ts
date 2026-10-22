import { noise } from './image-math';
/** Area of a centered circular ink dot clipped to a unit square cell.
 * This monotone threshold lets clustered dots merge continuously into full black.
 */
export function halftoneCoverage(distance: number): number {
  const radius = Math.max(0, distance);
  if (radius >= Math.SQRT1_2) return 1;
  const area = Math.PI * radius * radius;
  if (radius <= 0.5) return area;
  const outsideSegment = radius * radius * Math.acos(0.5 / radius) - 0.5 * Math.sqrt(radius * radius - 0.25);
  return Math.min(1, Math.max(0, area - 4 * outsideSegment));
}

/** Seeded random screening: two inks, not additive RGB noise. Size is an output-pixel grain cell. */
export function newsprintTone(luminance: number, x: number, y: number, size: number, inkDensity: number, seed: number, gamma = 1): number {
  const unit = Math.max(0.5, size);
  const lightCoverage = Math.max(0, Math.min(1, Math.max(0, Math.min(1, luminance)) ** gamma + (50 - inkDensity) / 150));
  return lightCoverage > noise(Math.floor(x / unit), Math.floor(y / unit), seed + 101) ? 1 : 0;
}
