# Pixel game-dev icon library

Type: task
Status: resolved

Build the icon library before the procedural LCD playground. Original single-color 16×16 grid art, inspired by the supplied tiny pixel silhouette reference, not traced from it. Cover hardware, development tools, game objects, audio, and UI. Keep the portrait experiment at `/`; add a separate `/icons` gallery with search, categories, inspector, native-size previews, DialKit color/scale controls, SVG copying/download, PNG download and full-sheet export. Reusable row data and rendering functions must work in later LCD artwork.

## Reference inspection

Downloaded Pinterest pin https://in.pinterest.com/pin/404549979050898714/ video to ignored `artifacts/references/pixel-motion.mp4`. Inspected sampled frames and a 12-frame contact sheet across seconds 1–5. The 30-second reference is a FUI animation field guide: Blinky, Glitch, Trail, Stroke-n-fill, Shuffle, Crash-n-blink, Slide-n-blink, Color flash, Build on. It is not a cellular automata example. No automatic animation in the icon gallery; motion can be evaluated separately later.

## Comments

Procedural algorithm work remains separate; no LCD UI should displace this library or the existing portrait experiment.

## Answer

Implemented 32 original icons and `/icons` gallery. Shared API in `src/icons/library.ts`, React glyph in `src/icons/PixelGlyph.tsx`. All 167 unit tests pass, including existing portrait and staged automata tests. Icon QA: 38 browser checks plus mobile overflow/selection/return checks; all SVGs match Canvas pixel-for-pixel. Existing 35 portrait renderer checks pass. Typecheck and production build pass (existing chunk-size advisory remains). Default green palette axe WCAG A/AA audit: zero violations; custom color combinations remain user-controlled. Viewports tested: desktop and emulated 390×844, not physical mobile hardware. Browser QA uses a nonempty replacement query: the current agent-browser empty-string fill did not dispatch React search clearing reliably.
