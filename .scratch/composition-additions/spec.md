# Animated icon assets, shared colors, mirror, and layout alternatives

Type: task
Status: resolved

## Request

Visible cutout mirroring, downloadable transparent animated icons, purple reference scheme, neon and red/white-gray colors, Pocket Blue in Compose, and alternative compositions.

## Decisions

- Use APNG (lossless RGBA animation) rather than WebP/HEIF because a small browser-only encoder can preserve alpha reliably without a service, codec binary, or new dependency. Clean poster frame60ms, effect duration1200/speed ms sampled at25fps, quiet hold1000ms; optional one-shot vs infinite repeat. Reuse exact icon SVG renderer with screen/grid excluded, retaining partial-alpha depth shadows. Full-canvas SOURCE replacement prevents transparent holes accumulating old frames.
- The browser-local APNG encoder emits PNG signature/IHDR/acTL/fcTL/IDAT/fdAT/IEND with CRC32, per-frame deflate, explicit delays and loop count. Dimensions and total decoded pixel volume are bounded; input data snapshots before async compression.
- Share15 palettes through `src/palettes.ts`, so Icons/LCD/Compose have the same set. Purple reference `/Users/tug/Library/Application Support/com.raycast.macos/clipboard/file-03a55e1c644646864145e2543aea2cf1.png` inspected and sampled: base#7a2d8d, dark pixels#601b70. Keep muted Violet LCD plus a higher-contrast Violet/chalk; add Neon cyan/pink/lime and red/chalk/red-screen. Pocket blue now in Compose. Neon presets start Flat to avoid amber illumination tint; settings remain editable.
- Visible Mirror cutout button in Cutout Lab and Compose; first lab mirrors only portrait+outline, not procedural backing, and preserves it in exports/transfers. Compose flip independent of layout direction.
- Four layout cards: Interview Split, Reverse split, Quote banner, Game first. Reverse changes column positions without flipping photos/gameplay. Banner reserves full-width quote space. Game-first expands the gameplay column. Presets preserve assets/text and keep framing controls editable.

## Validation

All checks pass: 301 unit tests; 36 new additions browser/independent decoder assertions; existing 24 composition, 38 icon (+mobile navigation), 26 motion, 40 LCD, and35 portrait renderer checks. Typecheck/build pass with the existing nonfatal bundle-size advisory. Pillow independently recognizes all12 default APNG frames, real alpha in every frame, changing pixels, 1460ms total duration at3× and correct infinite/one-shot flags. First and final clean frame hashes match, proving SOURCE replacement clears transient pixels. UI mirror round trips, four distinct layout images, palette effects on rendered PNGs, and390px mobile overflow verified. Violet banner and mobile layout cards inspected. Automated WCAG A/AA audit reports zero violations; decorative palette/DialKit contrast remains manual review. Physical phones and third-party APNG editors were not tested.

Key files: `src/icons/apng.ts`, `animation-export.ts`, updated icon export UI; `src/palettes.ts`; `src/composition/layouts.ts` and arrangement-aware renderer/cards; portrait mirror control/renderer. Browser fixtures and decoded animation are ignored under `artifacts/additions-qa/`. `npm run qa:additions` needs Python/Pillow solely for independent QA; exports run entirely in the browser.
