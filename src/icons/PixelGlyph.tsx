import { iconPath, type PixelIcon } from './library';

/** A single-color glyph with an integer viewBox; inherits the caller's text color. */
export function PixelGlyph({ icon, size = 64 }: { icon: PixelIcon; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true"><path d={iconPath(icon)} /></svg>;
}
