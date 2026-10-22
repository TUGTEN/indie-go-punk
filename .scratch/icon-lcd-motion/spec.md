# LCD materials and game icon motion

Type: task
Status: resolved

## Request

Implement the previously discussed Figma LCD depth on the original game-dev icons. Add restrained Flipper-inspired amber backlight/glow. Apply the Pinterest field-guide idea to the actual icons: glitch, blink, and other game motion effects.

## Decisions

- Preserve clean glyph APIs and original cutout experiment. Extend `/icons`.
- Reflective green: screen #477E43, pixels #2D612D, rear silhouette #173C1C at 18%. At the 240px inspector, native cell scale12 gives X3/Y5 displacement and Gaussian sigma3 (an approximation to the proposed 6px Figma blur extent). Front glyph stays sharp; no whole-image blur.
- Backlit orange: dark pixels, warm screen gradients/edge shading plus restrained external halo. It is an artistic material, not physical hardware emulation. Keep palette independent of Flat/LCD/Backlit.
- Selected inspector alone animates. Six deterministic effects (Glitch/Blink/Build/Scan/Hit/Ghost) plus None. One short event per 3.6s base cycle, quiet majority, no repeated fast flashing. At most24fps. Pixel displacement stays integer-cell aligned. Hidden tabs suspend rather than accumulate elapsed time. Reduced motion stops effects and leaves material visible.
- Play/pause/replay/speed/scrub. Captured frame PNG shares the sampled SVG renderer, preserving the actual effect phase and depth. Clean SVG/PNG/sheet exports remain unchanged. No GIF/video export; external CSS bezel/halo is not baked into PNG, screen lighting is.
- New DialKit persistence key v2 intentionally resets old flat defaults to the actual reflective green recipe.

## Implementation

`src/icons/artwork.ts`, `artwork.test.ts`: pure SVG material and sampled-frame renderer.
`src/icons/ArtworkGlyph.tsx`: per-instance SVG IDs.
`src/icons/IconMotionPreview.tsx`: isolated playback clock and reduced-motion/visibility lifecycle.
`src/icons/IconLab.tsx`, `icons.css`: material presets, controls, inspector, captures.
`scripts/qa-icon-motion.mjs`: browser assertions and frame parity.

## Validation

195 unit tests pass; typecheck/build pass (pre-existing chunk-size advisory). 22 new browser motion/material checks pass, including raster changes for each effect, pause/play/replay/scrub, unique SVG IDs/reference resolution, PNG dimensions/transparency/pixel parity, live reduced-motion changes, and mobile overflow. Existing38 icon browser checks plus mobile navigation and35 portrait renderer checks pass. Screenshots inspected at desktop; 390px emulated mobile verified, not physical hardware. Amber axe WCAG A/AA: zero violations, gradient-background contrast nodes require manual review. Gallery metadata uses a separate contrasting UI color rather than low-contrast LCD pixel ink.

## Comments

The green material is intentionally muted and non-emissive; orange receives the warmer glow. Increase Depth only when more separation is wanted, and use Flat for a clean comparison.
