# Figma controls for monochrome LCD art

Primary-source research: official Figma Help Center pages, retrieved with Firecrawl. These are documented capabilities, not results of testing a particular Figma file.

## Verified capabilities and controls

### Drop shadows

Select the target layer/group/frame → right sidebar **Effects** → add an effect (the documented default is **Drop shadow**) → **Effect settings**. Controls are **X**, **Y**, **Fill** (color and opacity), **Blur**, and **Spread**. X/Y offset the shadow horizontally/vertically; increasing Blur softens it. Shadows can be applied to individual layers, groups, frames, and components. A layer supports up to eight drop shadows. [1, “Shadow effects” / “Add shadow effects”]

**Important spread restriction:** Spread only works on rectangles, ellipses, frames, and components—not groups, arbitrary vectors, or text. Frames/components additionally require **Clip content** enabled and a visible fill of at least **1% opacity**. Setting Spread through the Plugin API does not bypass canvas support restrictions. [1, “Shadow spread”]

Figma normally hides the shadow through a layer’s transparent areas. **Show behind transparent areas** in shadow settings enables it when the documented fill/stroke transparency or non-Normal fill/stroke blend-mode conditions are met. Inner shadows do not have this option. [1, “Show drop shadows through transparent layers”]

### Layer blur versus background blur

- **Layer blur** blurs the selected artwork itself; **Background blur** blurs layers behind the selection. Both offer **Uniform** and **Progressive** variants. Uniform applies the same blur throughout; Progressive controls blur size, direction, and start/end intensity. [1, “Blur effects”]
- To apply: select the object → **Effects** → choose **Layer Blur** or **Background Blur** → **Effect settings** → adjust blur; adjust fill opacity if needed. Both support groups, frames, components, and individual layers. [1, “Apply blur effects”]
- To see background blur, Figma specifies a fill opacity between **0.10% and 99.99%**; a 100%-opaque fill hides it. Background-blurred layers behind another background blur are ignored rather than repeatedly blurring the existing blur. Background blur is typically the slowest effect to render. [1, “Background blur”]
- Layer blur extends beyond the selection boundary. Critically, adding layer blur to the same layer as a blended drop shadow isolates that shadow’s blend mode: it interacts with that layer’s other effects, not the content behind the layer. Fill/stroke blend modes are similarly isolated; Figma suggests applying the blend mode to the entire layer in **Appearance** to interact with external content. [1, “How layer blurs and unclipped textures impact rendering”]

### Blend modes

- Whole layer: **Appearance → Apply blend mode**. Fill/stroke: open its color picker → **Apply blend mode**. Shadow: select the effect → **Apply blend mode**. Each target has one blend mode; hover menu options for a live preview. Drop shadows, inner shadows, and noise support effect-level blend modes. [2, “Apply a blend mode”]
- **Multiply** darkens; white preserves the underlying color. **Screen** lightens; black preserves the underlying color. **Normal** does not blend colors. [2, corresponding mode sections]
- **Pass through** on a frame/group allows child blend modes to interact with content beneath the parent. **Normal** on that parent prevents those interactions outside the parent. Pass through is not available on fills/effects. Parent isolation therefore matters even when a child shadow’s settings are unchanged. [2, “Pass through” / “Normal”]

### Groups versus frames

Both accept shadows: converting a group to a frame is **not required** merely to add a shadow. Figma documents distinct group/layer render orders, particularly visible with overlapping shapes; do not assume a group shadow is equivalent to separate shadows on every child. Group rendering places the drop shadow below the individual paints/masks/effects. [1, “Render order”]

Frames additionally have their own **Fill**, **Stroke**, **Effects**, and **Clip Content** controls; Clip Content hides child objects extending beyond the frame bounds. This is a content-clipping control, not a documented instruction to hide the frame’s own external shadow. Use the frame’s fill deliberately, and observe the separate Spread requirements above. [3, “Frame properties”; 1, “Shadow spread”]

## Suggested artistic starting points — not official presets

For an illustrative monochrome LCD, try a muted light gray-green substrate and dark desaturated green pixels. Keep primary pixel shapes crisp; test a dark **Drop shadow: X 1, Y 1, Blur 1–2, opacity 15–25%, Spread 0** for slight separation. These numbers are subjective, in Figma canvas units, and depend on artwork scale.

Prefer a separate duplicate of the pixel artwork with a small Uniform **Layer blur** and low opacity if a soft ghost image is desired. Use **Multiply** experimentally to integrate dark artwork into the substrate; verify the parent’s blend mode and the layer-blur isolation caveat. Reserve **Background blur** for an intentional translucent cover effect, not for softening the pixels themselves. None of these choices is an official Figma LCD recipe or a guarantee of physical LCD accuracy.

## Sources

1. [Figma — Apply effects to layers](https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers). Official controls, limitations, render order, and blur/blend interaction.
2. [Figma — Apply blend modes to layers, fills, and effects](https://help.figma.com/hc/en-us/articles/360040667874-Apply-blend-modes-to-layers-fills-and-effects). Official control locations and mode behavior.
3. [Figma — Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design). Official frame properties and clipping behavior.
