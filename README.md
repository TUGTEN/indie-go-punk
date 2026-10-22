# Indie Go Punk — Thumbnail Experiments

Local portrait, pixel-icon, and procedural LCD playgrounds for the Indie Go Punk podcast. A new split-layout Composition Lab combines them as an experiment, not a finished thumbnail product.

## Run

Use Node.js 24+ (or Node 22.12+).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173).

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Optional real-browser renderer regression checks, with the dev server running and [agent-browser](https://github.com/vercel-labs/agent-browser) installed:

```sh
npm run qa:renderer
```

## Pixel icon library

Open [Pixel Icons](http://127.0.0.1:5173/icons); the original Cutout Lab remains at `/`.

- 32 original single-color 16×16 icons: hardware, development, game objects, and audio/UI.
- Search and category filters; select an icon to inspect it at native and enlarged integer sizes.
- DialKit ink/paper controls, green LCD / Flipper-inspired orange / paper / black-white / inverted presets. Grid is a preview guide, never exported. Surface selects Flat, reflective LCD, or Backlit; Depth and Glow tune the material. Defaults now use the Figma green recipe, with independent sharp foreground and soft displaced rear silhouette. Orange uses a warm backlit field with a restrained rim bloom, not emissive white pixels or an exact Flipper hardware simulation.
- Download or copy a transparent SVG; export PNG at 1–20× integer scale, optionally with the selected paper background. Download the full 1280×720 SVG icon sheet.
- **Motion Cartridge:** RGB chromatic Glitch, Blink, Build, Scan, Hit, Ghost, or None. Choose an effect, then click **Trigger effect** for an immediate, pronounced 1.2-second one-shot at 1×. Default speed is 3× (~400 ms); speeds go up to 4×. Click again to restart; choose 0.5× to inspect more slowly. No timeline or automatic looping. Reduced-motion settings disable the trigger; hidden tabs suspend the clock. Deterministic sampled SVG geometry runs at up to 30 fps and is shared with frame exports.
- **Capture LCD frame PNG** saves the current motion frame and pixel depth at 20×Pixel Scale square dimensions (the 16-cell glyph has 2-cell padding on each side). Disable Transparent Png to include the backlit/reflective field. Clean SVG/PNG and full-sheet exports remain static glyph assets. GIF/video/animated SVG export is not implemented. The external CSS halo/bezel sits outside the captured image; the screen lighting inside it is exported.
- **Download transparent APNG** exports the chosen effect and speed with real RGBA alpha, including soft LCD pixel shadows but no opaque screen/grid/bezel. Dimensions are 20×Pixel Scale (up to 400×400). Choose Loop for repeated playback with a 1-second quiet hold; uncheck it for a one-shot asset. A clean 60 ms poster frame comes first. At default 3×, motion lasts 400 ms. APNG preserves colors and partial transparency without a service or encoder dependency; some editors show only its first frame, so use an APNG-compatible app/browser. WebP/HEIF/video encoding is not provided. Reduced-motion preference disables in-page triggers, not explicit file exports.
- Shared screen/motion renderer: `src/icons/artwork.ts`; React wrapper `ArtworkGlyph.tsx` isolates SVG definition IDs across instances. Browser motion QA: `npm run qa:icon-motion` (including all effects, actual RGB pixels, trigger/retrigger/settle, frame raster parity, reduced-motion changes, and mobile layout).
- Reusable API: `icons`, `iconPath`, `iconSvg`, `drawPixelIcon` from `src/icons/library.ts`; React `PixelGlyph` from `src/icons/PixelGlyph.tsx`.
- Browser checks: `npm run qa:icons` with the dev server running. Includes all 32 SVG/Canvas pixel comparisons, filtering, selection, palette sync, actual UI export blobs, and mobile overflow.
- The Pinterest reference was fetched and sampled: it is a FUI motion guide, not a cellular-automata demo. The procedural LCD playground is a separate experiment at `/lcd`.

## Procedural LCD playground

Open [LCD Lab](http://127.0.0.1:5173/lcd).

- Conway's Game of Life B3/S23, elementary rule 0–255 history, cyclic multi-state automata, and genuine WFC circuit tiles using lowest-entropy collapse and matching-port propagation. WFC retries bounded contradictions and never treats an invalid solve as a finished field.
- Seed / Apply / Regenerate / Reset; Step and Play/Pause for evolving algorithms. WFC is a static completed solve; its time controls are intentionally disabled. Elementary center-cell history ignores seed unless Random Start is enabled. Settle pre-advances Life/Cyclic, not Elementary/WFC.
- Resolution 80×45 / 160×90 / 240×135. Integer-pitch cells are centered inside the fixed 1280×720 canvas; fine grids have a small screen margin. Wrap sets simulation boundary behavior; the initial elementary history uses dead boundaries.
- Editable screen/pixel colors, reflective green, Flipper-inspired amber, pocket blue, paper, black-white, inverted. Two tone thresholds states; Shaded interpolates colors (tinted grayscale in color palettes, neutral grayscale in black-white). Use Flat + Two tone for exact two-color output. LCD/Backlit intentionally add material shading.
- Depth uses a separate low-opacity blurred/displaced rear silhouette, never a blur on sharp foreground cells. Backlit adds a restrained warm field highlight. All screen lighting/depth is baked into exports; exterior UI framing is not.
- Optional original hero icon with a clean center clearing. Motif scale is clamped to fit without distortion. This changes the composition, not the underlying simulation.
- Export PNG snapshots the current visible frame at exactly 1280×720 and pauses playback. No video/GIF export. Reduced motion leaves Step available but disables automatic play; hidden tabs suspend simulation.
- CPU/readback Canvas contexts avoid Chromium's GPU-to-CPU migration changing blur rounding after repeated reads. Browser regression checks verify repeated resets and fresh export canvases pixel-for-pixel.
- `npm run qa:lcd`: 40 browser checks covering transport, seeds, palettes/tones, depth/motif/gap, repeated-render parity, actual PNG pixels, reduced motion and mobile layout. Pure tests cover algorithms, WFC adjacency/contradictions and renderer math.

## Shared color schemes

`src/palettes.ts` supplies the same 15 schemes to Icons, LCD Lab, and Compose—including Pocket blue in Compose. Violet LCD samples the supplied purple reference (screen `#7a2d8d`, ink `#601b70`); its muted contrast is intentional. Violet / chalk is the higher-contrast alternative. Neon cyan/pink/lime pair bright inks with dark screens. Red / chalk uses red ink on light gray-white; Red screen reverses that emphasis. All schemes retain editable colors and Two tone/Shaded modes; neon presets start Flat to avoid the amber material tint.

## Split composition experiment

Open [Composition Lab](http://127.0.0.1:5173/compose).

- Left cutout + stepped pixel speech bubble, top-right pinned gameplay frame, bottom-right game title. Switch person attribution between bottom-left nameplate and inside the speech bubble.
- Confirmed negative typography: **solid screen-colored bitmap lettering on opaque dark panels**. The procedural pattern does not show through letter shapes. The original built-in 5×7 uppercase font wraps and auto-fits; accents normalize, unsupported characters become `?`, and truncation is reported. Quote/name/role/game text are editable.
- Upload transparent portrait PNG and a gameplay screenshot (PNG/JPG/WebP/AVIF, under 20 MB and 40 megapixels; downsampled to 1800 px max edge). Portrait alpha margins are trimmed. Opaque portraits work but are not automatically segmented here; prepare them in Cutout Lab.
- In **Cutout Lab**, click **Send cutout ↗** after treatment. The current recovery/filter/outline/framing is rendered without the background, explicitly saved as one local IndexedDB PNG, then opened in Compose. **Use latest cutout** loads it again; **Forget saved cutout** deletes browser storage. Gameplay, direct uploads, and editable copy remain in memory and reset on reload; DialKit settings persist locally. No image server upload.
- DialKit adjusts split/margins/gutters, speech bubble height and tail position, portrait zoom/offset/flip, gameplay width/aspect/cover-zoom/pan, type sizes and panel depth. A tall gameplay frame shrinks rather than colliding with the game-title panel, while preserving its selected corner anchor (left in Reverse split). Uploaded images use high-quality scaling; text and panel steps stay crisp.
- Layout cards compare **Interview Split**, **Reverse split** (portrait right, gameplay left), **Quote banner**, and **Game first** (wider gameplay column). Presets keep your uploads and text, while setting arrangement/split/panel geometry/quote size; remaining controls stay editable. The reverse layout changes positions, not image orientation. **Mirror cutout ⇄** in Compose flips just the portrait, independently of layout. The same visible button in Cutout Lab mirrors the portrait and outline without mirroring the procedural background, and is preserved by PNG export/Send cutout.
- LCD background reuses all four procedural algorithms, seeded regeneration, two-tone/shaded rendering and materials. Color presets include readable green, reference-like green, amber, paper and black-white/inverted. Panels themselves clear negative space; no background texture leaks into the text.
- Export is an exact current-preview **1280×720 PNG**. This is a static composition study, not an animated-video export or an automatic final thumbnail layout engine.
- `npm run qa:compose` tests the real cross-page Send workflow, transparent trimming, gameplay upload/aspect, attribution modes, negative panel colors, pattern isolation, invalid input retention, local-storage deletion, repeat renders and exact PNG parity. Synthetic fixtures are generated in ignored `artifacts/composition-qa/`; original supplied cutout was also checked manually. Desktop Chromium and emulated 390px mobile tested, not physical phones.
- `npm run qa:additions` additionally checks actual APNG download/one-shot flags, independent Pillow frame decoding/alpha/timing, mirrored cutouts, all layout alternatives and shared palettes/mobile overflow. It requires Python 3 with Pillow for the independent decoder; the application itself does not use Python.

## Workflow

1. Upload or drop a JPG, PNG, WebP, or AVIF (up to 20 MB / 40 megapixels). Very large images are resized to an 1800 px maximum dimension before processing.
2. Background removal runs locally using IMG.LY. **High quality** (FP16 ISNet, roughly 80 MB model plus runtime) is the default; **Fast** (quantized, roughly 40 MB) is optional. Assets are cached by the browser. Change Cutout → Quality and click **Re-cut** to apply it. Inputs are not sent to a segmentation server.
3. Transparent uploads are kept as-is when more than 1% of their pixels have alpha below 240. Uncheck **Remove background** before uploading to keep an opaque image as-is. On failure, retry or use a pre-cut transparent PNG.
4. Pick a starting look, then tune the real **DialKit** panel. Controls and saved DialKit versions persist locally; uploaded images do not persist after reloading.
5. For **head + chest**, begin with a portrait photograph or increase **Portrait → Crop Bottom**, then adjust Zoom, Horizontal, and Vertical. Framing is manual; this is not head/body-part segmentation. A full-body picture is not automatically cropped anatomically.
6. Export PNG: square 1080 × 1080, landscape 1280 × 720, or portrait 1080 × 1350. Enable Background → Transparent for a reusable cutout sticker. **Original** is a comparison view; export always uses the edited result.

## Difficult / low-resolution portraits

- The supplied 400 × 400 outdoor portrait exposed substantial false positives in Fast. High quality worked much better at native resolution; 2× conventional pre-enlargement did not show a useful improvement. See the [comparison notes](docs/research/low-resolution-portraits.md).
- **Cutout → Keep Main** removes disconnected background islands; disable it for multiple subjects or detached accessories. **Cutoff** is a 0–100% alpha-confidence cutoff. **Trim** and **Feather** operate in source-image pixels before enlargement. Feathering is constrained to existing alpha support so transparent black RGB is never revealed as a halo.
- **Lift face shadows** applies a conservative starting recipe: Exposure +0.3 stops, Shadows 65, Local Contrast 15, Sharpen 25, Denoise 15; artistic Contrast 1.03 and Grain 3. Fine-tune under **Recovery**. This affects the whole cutout, not automatically detected facial regions, and does not invent missing detail.
- Recovery works at native source resolution before high-quality Canvas enlargement. Exposure uses linear-light gain; shadows get a highlight-protected lift; local contrast and unsharp detail are capped; mild denoise is edge-aware. Global artistic contrast is applied afterward.
- **Refine mask** provides Erase / Restore, an optional dim original guide, undo and reset. Brush radius is in source pixels. Apply edits to commit; Escape discards them. This edits the raw matte; automatic cleanup still applies afterward. **Re-cut replaces manual edits.** Undo history is bounded to 24 MB / 12 snapshots; portrait images themselves are not saved to browser storage.
- There is no generative super-resolution or face reconstruction. A small blurred face remains limited by its captured information; making it bigger cannot recover authentic eyelashes or eye detail.

## Aesthetic controls

- **Photo:** contrast, brightness, saturation, warmth, and portrait-only monochrome grain.
- **Duotone:** continuous luminance mapping between Ink and Highlight colors; preserves tonal gradation. This is a digital approximation, not a press separation.
- **Halftone:** 45° clustered-dot screen, continuous dot growth through shadow tones, **Halftone Size** directly controls dot pitch in output pixels. The Copy machine preset also exposes a contextual **Halftone dot size** slider above the preview.
- **Dither:** repeating 8 × 8 Bayer ordered dither; **Dither Pixel Size** directly controls the width of each dither pixel (1–16 output px), independent of halftone dot size. The Save state preset exposes the same slider above the preview.
- **Pixel border:** max-pool only the alpha silhouette into a coarse grid, dilate it with a square kernel, then put the original detailed portrait on top. Width snaps to whole blocks; Pixel Size controls the steps. Mask Threshold affects pixel/sketch border extraction, not the portrait matte.
- **Sticker border:** rounded expansion behind the original cutout.
- **Sketch border:** three correlated, lightly interrupted contour passes; **Sketch Stroke** / contextual **Sketch pen width** controls pen thickness (0.5–20 output px). Width / contextual **Sketch outline gap** independently controls distance from the cutout, including zero. Roughness controls displacement. This is an approximation of a pen outline, not hand-drawn artwork.
- **Paper:** seeded fine grain, correlated soft mottling, and elongated fibers. **Noise:** uncorrelated grain. Background texture is separate from portrait grain; Reseed changes the procedural pattern, not the cutout.
- **Newsprint / Street press:** high-contrast black/cream portrait with seeded random ink screening, blended with a continuous duotone to retain facial gradation. **Stipple Size**, **Ink Density**, **Print Gamma** (below 1 lifts midtones), and **Screen Strength** (0 = continuous, 1 = fully screened) control the portrait. These are artistic print approximations, not a physical press simulation.
- **Grunge:** two-color generated background. Color is the base, **Grunge Ink** is the second ink. **Patch Size**, **Coverage**, **Distress**, and **Edge Bias** shape organic distressed ink patches. **Strength** / **Scale** add fine background grain. Coverage is an artistic threshold rather than an exact area percentage; Edge Bias favors sides/corners to leave space for a portrait. Reseed changes the composition deterministically.
- **Street press** combines Newsprint with cobalt blue / magenta Grunge and no border, inspired by the supplied reference. It does not reproduce trees, stars, headline text, video controls, or the reference's exact composition. Generated grunge was chosen instead of uploading a second image.

Saturation and Warmth apply to Photo. Ink and Highlight apply to all four print treatments. Pixel Size controls only the border; Halftone Size and Dither Pixel Size are independent portrait controls, replacing the old shared Pattern Size. Contextual controls above the canvas write to the same DialKit state and stay in sync. Other parameters remain visible in DialKit when their mode is inactive.

Start with warm photo + cream pixel edge + restrained green paper. Keep halftone and dither as separate directions rather than layering every effect. Tiny patterns can alias when scaled; inspect the exported PNG at its intended display size.

## Technical notes and scope

- React + TypeScript + Vite; Canvas 2D renderer; DialKit 2.
- Background removal: `@imgly/background-removal` 1.7.0 with `onnxruntime-web` 1.21.0, FP16 or quantized ISNet on CPU in a worker. No API key needed. Hair/edges vary with image quality; use the manual mask editor for misses.
- Vite development and preview servers set COOP/COEP headers. Any deployment must also serve `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` for the same isolation behavior. Production model assets default to IMG.LY's CDN; self-host/version them for an offline deployment.
- Background, framing, filter, border, and final portrait composite are cached separately. Native shadow pixels are frozen in the composite so exports match the preview. Seeded texture does not flicker while adjusting other settings.
- Built runtime assets include a relatively large WASM binary. The main build also has a non-fatal chunk-size advisory; model code is dynamically loaded only when removal is needed.
- **Licensing before publishing:** IMG.LY's background-removal package is AGPL-3.0 licensed, with commercial licensing available. Review its obligations before distributing or hosting the eventual tool. No third-party portrait or reference-image asset is bundled with this project.
- Responsive layout was checked in desktop Chromium and a 390 px emulated viewport, not on physical phones. Desktop Chromium is the tested experiment environment.

## Research

- [Portrait aesthetics and sources](docs/research/portrait-aesthetics.md)
- [Earlier LCD experiment](docs/research/lcd-figma-recipe.md)
- [DialKit official repository and API](https://github.com/joshpuckett/dialkit)
- [IMG.LY browser background removal](https://github.com/imgly/background-removal-js/tree/main/packages/web)

## Validation

- 51 Vitest checks for alpha bounds, O(n) mask dilation, deterministic noise, ordered-dither thresholds, halftone coverage, mask refinement, non-generative portrait recovery, newsprint screening, and seeded grunge generation.
- 35 browser-renderer checks: all treatments/borders/textures, crop and output sizes, transparency, deterministic redraw, matching fresh export, empty-mask rejection.
- Manual browser flow: uploaded the supplied portrait reference, removed background in development and production-preview builds, switched presets, exported square/landscape and transparent PNGs, re-uploaded transparent output, and checked invalid-file handling.
- Difficult-image flow: compared Fast / High quality / shadow-lifted input / 2× pre-enlargement on the user's 400 × 400 original. Verified manual Erase, Restore, Undo, Apply, Escape and focus return; exported the enhanced portrait.
