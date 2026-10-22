# Experiment 01: monochrome LCD depth in Figma

## Goal and evidence

Recreate the green pixel-art wallpaper supplied by the user, especially the soft offset darkness underneath the sharp pixel shapes.

Reference: `/Users/tug/Library/Application Support/com.raycast.macos/clipboard/file-2c61b192f6c773723ebd90168afdf15b.png` (3024 × 1900).

Visual observations: dark-green square cells separated by fine green gaps; muted green field; soft displaced darkness behind the artwork; restrained broad lighting variation; no strong glossy streaks or visible RGB subpixels. These observations do not establish how the original artist built the wallpaper.

Reflective LCDs modulate ambient light through polarizing and liquid-crystal layers and return it from a rear reflector. Manufacturer explanation: https://www.kadidisplay.com/blog-news/how-does-a-reflective-lcd-display-work-a-comprehensive-guide/ . This supports a layered visual model, not a claim that the wallpaper is a physically accurate simulation.

## Recommended method

Use sharp pixel artwork plus a separate, blurred, offset silhouette beneath it. This gives independent control of apparent depth. A drop shadow on the transparent artwork is the simplest one-layer alternative. Do not apply the shadow to an opaque background rectangle.

These colors and settings are proposed starting points, not measured source values or documented Figma defaults. Tune at final output size.

## Layer stack, top to bottom

1. Optional surface wash: large white-to-transparent gradient, only 2–4% white at its brightest; no blur initially.
2. Sharp active pixels: dark green, suggested `#2D612D`.
3. Optional inactive pixel grid: same green at 3–5% opacity; omit initially because the reference's blank areas are mostly clean.
4. Rear shadow: duplicate of active pixels, filled `#173C1C`, layer blur, low opacity, offset down and right.
5. Reflector/background: suggested `#477E43`, with a subtle broad gradient from `#4D8548` to `#3E7439`.

The surface wash is an artistic cue, not a refractive material. The depth primarily comes from the sharp foreground and soft displaced silhouette.

## Figma steps (1280 × 720 experiment)

1. Create a frame with the green background. Start with one small pixel icon and one line of pixel text rather than the entire wallpaper.
2. Build artwork from square cells: start with 8 × 8 cells on a 9 px pitch (1 px gaps). Use no stroke or corner rounding. The common grid is more important than the exact cell size.
3. Group only the active pixel artwork; keep the green field outside that group. Keep the master artwork editable. For easy shadow editing, a duplicate can be flattened to a vector silhouette.
4. Duplicate the artwork underneath. Recolor it dark green, set layer opacity to 18%, move X +3 / Y +5, and apply Layer blur 6. Keep the sharp foreground at full opacity.
5. Compare three variants with all other settings identical:

   | Variant | X | Y | Layer blur | Shadow opacity |
   | --- | ---: | ---: | ---: | ---: |
   | Tight glass gap | 1 | 2 | 3 | 14% |
   | Reference-like starting point | 3 | 5 | 6 | 18% |
   | Exaggerated diagnostic | 5 | 8 | 10 | 22% |

6. Once the depth works, introduce the subtle background gradient and optional surface wash. Add texture only if needed, keeping it barely visible at final size.
7. For the wallpaper's diagonal arrangement, rotate the pixel artwork as a unit before making the shadow duplicate. Then offset the shadow in canvas coordinates so every icon shares one light direction.
8. Inspect at 100% and at a thumbnail-sized preview. Export a PNG to verify that thin cell gaps survive downsampling. If resizing the design, scale blur and offsets with it, not just the shapes.

## Faster alternative: Drop shadow

On the active pixel artwork only, try Drop shadow X 3, Y 5, Blur 6, Spread 0, color `#173C1C` at 18%. It generates its own shadow without a second editable silhouette. Compare visually with the duplicate method; they need not composite identically.

## Why not Background blur or a glass preset?

A broad background blur over the complete image softens the crisp cells that sell the reference. Layer blur on the shadow softens only the rear image. Start without refraction, chromatic fringes, white bevels, CRT scanlines, bloom, or strong reflections: those describe different materials and can overwhelm this particular reference.

## Tuning rules

- Looks printed flat: increase offset slightly before increasing opacity.
- Looks like raised plastic/buttons: reduce shadow contrast, remove highlights/bevels, and keep pixels flat.
- Looks like motion blur: reduce displacement and keep the foreground fully crisp.
- Looks dirty/muddy: reduce blur or opacity; keep fine cell gaps visible on the front layer.
- Looks neon: remove glow and reduce green saturation.

Official Figma capability research is recorded separately in `figma-lcd-sources.md`.
