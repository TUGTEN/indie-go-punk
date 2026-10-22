# Portrait cutout aesthetics: Canvas2D experiment

## Recommendation

Start with **warm photographic detail + an irregular cream cut edge on muted green**. Make **single-black halftone on offwhite** the strongly graphic alternative; keep ordered dither an explicitly digital third treatment. Do not stack every effect. The recipes and numeric ranges below are design proposals, not measurements from the references.

All sizes refer to final displayed pixels for a portrait approximately 600 px tall; scale proportionally for export.

## Three coherent directions

| Direction | Suggested treatment | Avoid |
| --- | --- | --- |
| Warm editorial collage — default | Green `#49614A`, cream `#F1E8D5`; retain photographic RGB, slightly reduce saturation, warm highlights, gently lift darkest tones. Cream outer border 7–12 px with slow irregularity; restrained monochrome grain inside photo. | Blanket sepia, clipped skin highlights, heavy speckles over eyes, perfectly uniform sticker border. |
| Black-ink print | Paper `#EFE9DC`, ink `#24211D`. Grayscale → mild tonal curve → clustered-dot halftone; start at 3–5 px cell pitch and one consistent screen angle (try 45°). Preserve open midtones and recognizable eye/nose/mouth separation. | A binary threshold of the whole face, giant dots, excessive simulated ink gain merging all shadows. |
| Hand-marked cutout | Keep photo or smooth two-color mapping; add 2–3 px chalk-white contour with small width variation, a few interruptions and occasional second-pass overshoot. Leave most facial features untraced. | Random jitter at every pixel; tracing every internal edge; combining large halftone, coarse dither and scratchy outlines simultaneously. |

### Photo, two-color mapping, halftone, or ordered dither?

- **Photo:** best first choice when identity and expression matter. Put the roughness in silhouette and material, not global face degradation.
- **Duotone-like:** map normalized luminance through a gentle curve into dark brown/green and warm cream; keep continuous intermediate values. This is a screen approximation, not a two-ink press separation. It offers graphic unity without throwing away facial gradation. Adobe describes actual duotones as multi-ink tonal reproduction [4; search excerpt only].
- **Halftone:** encode tone as varying ink coverage on a fixed lattice. For isolated circular dots, area—not radius—should track darkness: radius is proportional to the square root of coverage. Dark tones need merging dots or a complementary white-hole stage to reach full black; circles capped at half the cell pitch cannot cover the whole cell. Tune tone *before* screening. Mohawk explicitly documents dots spreading/deforming on absorbent uncoated stock and opening separations to retain brightness/detail [1]. Simulate only slight spread, not indiscriminate blur.
- **Ordered dither:** compare luminance with a repeating 4×4 or 8×8 Bayer threshold matrix; retain source-resolution facial sampling and begin with a 1 px dither unit. This suggests bitmap/zine/computer graphics rather than clustered print dots. Coarser 2–3 px units quickly trade expression for pattern. Keep separate from halftone, and evaluate at actual display size: resampling can introduce distracting pattern interference.

## Material: paper grain is not digital noise

**Physical basis:** uncoated paper is absorbent; its surface affects ink behavior, and its shade changes perceived printed color. Mohawk specifically warns that cream stock can require reducing yellow in skin tones [1]. This supports separating substrate color/texture from image treatment; it does not prescribe a particular synthetic grain algorithm.

**Proposed Canvas approximation:**

1. **Paper layer:** warm base plus very low-contrast, spatially correlated variation at several scales (fine fibers/specks, soft 8–30 px mottling). Start around 1–3% luminance variation. Keep the pattern fixed in page coordinates and seeded so it does not flicker on redraw.
2. **Photographic grain layer:** fine monochromatic variation confined to the portrait, with somewhat stronger visibility in midtones and less over delicate highlights. Start around ±2–4 levels in 8-bit RGB. This is an aesthetic approximation, not a film-emulsion simulation.
3. **Ink distress:** sparse low-opacity voids inside ink shapes, driven by the same paper field if possible. Do not scatter equal black-and-white salt-and-pepper noise over everything.

Keep the cream border relatively quiet. A little substrate continuity ties layers together; identical strong noise everywhere makes them look like one digital filter.

## Outline morphology without losing the face

Use an existing cutout alpha mask. **Morphology expands a silhouette; it does not segment a person from a photograph.**

- Keep the original RGB and antialiased alpha untouched for the final portrait. Derive a separate silhouette mask for outline operations.
- Dilate that mask with a disk neighborhood (local maximum). An exterior ring is `dilate(mask) − mask`; drawing the filled expanded mask in cream *behind* the original portrait is also sufficient. ImageMagick documents dilation, disk kernels and the equivalent external-gradient operation [2]. These are pixel algorithms that can be reproduced using Canvas `ImageData`, not an ImageMagick runtime requirement.
- For a **deliberately pixel-edged outline**, downsample only the silhouette, expand it with square/diamond morphology, then nearest-neighbor enlarge only that outline. Composite the full-resolution face on top. Square/diamond kernels produce a different contour character than a disk [2]. Never pixelate the entire photograph just to get rough edges.
- For **hand-cut**, vary the border radius slowly by approximately 1–2 px or perturb a traced contour along its normal. For **handdrawn**, use a thin contour path with correlated displacement and a few intentional gaps. A thick dilated ring alone reads as a sticker, not a pen stroke.
- Remove isolated mask islands and tiny holes only on the outline copy. Strong opening/closing can erase hair or bridge gaps between limbs; the documented operations explicitly remove small features or close holes [2].
- Pad the working canvas beyond the border radius to prevent clipped outlines. Preserve useful hair transparency; inspect halos on both dark and light backgrounds.

## Practical render order and acceptance checks

**Order:** prepare photo tones → derive independent outline → paper/green background → outline → detailed portrait or screened portrait → restrained material overlays.

Canvas2D supports RGBA read/write through `getImageData`/`putImageData`, grayscale transforms and independent smoothing control when drawing scaled layers [3]. Use separate canvases for paper, mask and portrait; render into intermediate canvases before compositing. Use same-origin or CORS-enabled images: tainted canvases block pixel access and export [3].

Compare four stills with identical crop/scale: warm photo, smooth two-color mapping, black halftone, ordered dither. Pick based on **recognizable eyes at thumbnail size**, open facial shadows, visible but subordinate texture, and an intentional silhouette. Check at actual display size and full export resolution; do not judge only zoomed-in dots. Prefer separate controls for tone, pattern pitch, material strength, outline width and outline roughness.

## Sources and scope

1. **Mohawk, _Printing Tips for Uncoated Papers_**, December 2008, pp. 1–2. Primary paper-manufacturer guidance; successfully read with Firecrawl. [PDF](https://d2sg07zx6lm3f.cloudfront.net/s3fs-public/2018-02/Printing_Tips_for_Uncoated_Papers.pdf). Relevant passages: “precise halftone dots spread and deform—a feature called dot gain”; “Keep paper shade in mind … particularly in skin tones.” Physical principles inform the simulation; press-specific percentages are not used as digital defaults.
2. **ImageMagick, _Morphology of Shapes_**. First-party implementation explanations and visual examples; successfully read with Firecrawl. [Dilation](https://usage.imagemagick.org/morphology/#dilate), [disk kernel](https://usage.imagemagick.org/morphology/#disk), [external gradient](https://usage.imagemagick.org/morphology/#edgeout), [closing](https://usage.imagemagick.org/morphology/#close).
3. **MDN, _Pixel manipulation with canvas_**. Canvas API reference/tutorial; successfully read with Firecrawl. [RGBA, pixel operations, smoothing, CORS/export](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas).
4. **Adobe, _Create and edit duotone images_**. Primary design-tool documentation located via Firecrawl search; full scrape blocked by anti-bot protection, so used only for the general duotone definition visible in the search excerpt. [Documentation](https://helpx.adobe.com/photoshop/desktop/adjust-color/color-effects-techniques/create-and-edit-duotone-images.html).

Bounded research: print-material guidance and pixel-operation references, not a historical survey or a claim of physically accurate print/film reproduction. No app code added.
