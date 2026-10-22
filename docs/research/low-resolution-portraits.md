# Low-resolution portrait: empirical comparison

## Input and failure

The user's original is a 400 × 400 JPEG: an outdoor chest-up portrait with a bright sky and a face in deep shadow. Its processed screenshot showed scattered sky/water fragments and a broad contaminated silhouette. The pixel border magnified those segmentation errors; it was not itself the segmentation failure.

This is a single-image experiment, not a segmentation benchmark or a guarantee for other photos. Derived test images are kept only in ignored `artifacts/quality/`, not bundled as application assets.

## Comparison performed locally

All runs used the installed `@imgly/background-removal` 1.7.0 + `onnxruntime-web` 1.21.0, CPU worker backend. No remote segmentation API or generative reconstruction.

| Input / model | Visual result |
| --- | --- |
| Original 400 × 400 / `isnet_quint8` (Fast) | Major false positives: sky, sea, and fragments surrounding the person. |
| Same original / `isnet_fp16` (High quality) | Substantially cleaner silhouette with the person retained. Small lower-left remnants and bright edge contamination can still need trimming or manual erasure. |
| Source RGB gamma-lifted with exponent 0.7 / FP16 | Similar silhouette; did not show an important improvement over FP16 on the untouched source. This was a diagnostic run, not the display-recovery algorithm shipped. |
| Original enlarged to 800 × 800 with high-quality Canvas smoothing / FP16 | Similar person cutout, with some lower-left background remnants. No useful visual win over native-resolution FP16; enlargement did not recover photographic detail. |

At alpha >100, the native Fast run retained 83,458 pixels, including 872 in the top 60 rows (above the person). Native FP16 retained 65,051 pixels and zero in that top strip; gamma-lifted FP16 retained 64,950 and zero. These are diagnostic counts, **not accuracy scores**: there is no hand-annotated ground-truth mask.

Timing for initial native runs was around 10–11 seconds including uncached assets; a subsequent cached FP16 run was around 1.2 seconds on this machine. Downloads, hardware, caching, and concurrency affect these numbers.

## Decision and implementation

1. Default to **High quality**, retaining Fast as an explicit tradeoff. Changing model selection requires **Re-cut**, rather than running inference on every slider change.
2. Work on alpha separately from the RGB photo: optional largest 8-connected subject, weak-alpha cutoff, fractional source-pixel erosion, small feather. Support for detached objects/multiple people requires disabling Keep Main. Cleanup is not a substitute for correct semantic segmentation, particularly when unwanted background is connected to the subject.
3. Add manual **Erase / Restore** on the raw mask for difficult edges. Include undo/reset, a dim original guide, and clear disclosure that re-cutting discards manual edits. Keep automatic cleanup as a separate subsequent step.
4. Perform photographic recovery at native source resolution: linear-light exposure, soft shadow lift with highlight protection, alpha-aware capped local contrast and thresholded sharpening, optional light edge-aware denoise. Never sample transparent black RGB into neighborhood detail operations.
5. Enlarge the corrected cutout with high-quality Canvas smoothing for composition; then apply the artistic treatment and generate the independent pixel/sticker/sketch border. Do not sharpen an already pixelated outline or the final background.

The one-click **Lift face shadows** recipe is Exposure +0.3 stops, Shadows 65, Local Contrast 15, Sharpen 25, Denoise 15, artistic Contrast 1.03, Grain 3. It is a starting point for this photograph, not automatic face detection. It affects the whole cutout; tweak it to avoid washed-out clothing or skin. Grain was reduced because existing JPEG blur/noise should not be amplified unnecessarily.

The renderer clamps feathered alpha to its existing source support: it softens inward instead of revealing RGB that PNG decoding may have made black. This reduces dark fringes on light backgrounds. Bright sky contamination already baked into semiopaque edge RGB may still need a tighter trim or manual mask edit; this is not full color decontamination.

## Private comparison files

- `artifacts/quality/fast.png`, `quality.png`, `quality-lift.png`: raw model outputs.
- `artifacts/quality/quality-2x.png`: conventional enlargement before segmentation.
- `artifacts/quality/before-composite.png`: original Fast pipeline reproduction.
- `artifacts/quality/after-composite.png`: FP16 + cleanup + recovery + pixel border.
- `artifacts/quality/enhanced-export.png`: PNG exported via the application.
- `artifacts/quality/enhanced-ui.png`, `mask-editor.png`: interface evidence.

## Remaining limits

The face occupies only a small part of a 400 px frame. Recovery can expose recorded tonal differences, not recover authentic missing eyelashes or eye texture. Strong sharpening creates halos and amplifies compression; aggressive AI face restoration can synthesize a different expression or features. Neither is a reliable default for representing real podcast guests. Request an original higher-resolution photo when available; otherwise use a modest portrait size and let the border/layout supply graphic impact.

Technical API sources: [IMG.LY browser package](https://github.com/imgly/background-removal-js/tree/main/packages/web), [Canvas image smoothing quality](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingQuality). The quality comparison above is direct local observation, not a claim drawn from those documents.
