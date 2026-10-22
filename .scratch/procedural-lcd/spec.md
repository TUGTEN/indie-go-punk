# Procedural LCD artwork playground

Type: task
Status: resolved

## Scope

Separate `/lcd` experiment, preserving `/` portrait and `/icons` pixel icon library. Browser-only seeded 1280×720 artwork. Conway B3/S23, elementary rule history, cyclic multi-state cellular automata, and genuine constraint-propagation wave function collapse circuits. WFC reports contradiction rather than returning invalid artwork. Shared canvas renderer for preview/export. No paid API.

## Controls

DialKit algorithm, grid resolution, density/rule/cyclic states/threshold, boundary wrap, simulation speed; explicit seed, reseed/reset, step/play/pause. WFC is a static solve, so Step/Play disabled with status explanation. Green LCD, amber Backlit, paper, black-white, inverted presets; editable two colors; Two tone vs Shaded (tinted interpolation across every palette), depth/glow/gap/threshold/inversion. Optional original game-dev hero glyph stamped over artwork. Reduced motion prevents autoplay/play; Step remains available. Pause clock for hidden tabs. PNG export exact1280×720 copies shown frame.

## Architecture

Existing `src/lcd/automata.ts` provides immutable seeded simulation fields. New `wfc.ts` solves matching edge-port tiles then rasterizes circuits. Pure app model wraps algorithms, regeneration, stepping. New `renderer.ts` composes crisp front cells plus low-opacity blurred/displaced rear, reflective field wash or amber lighting; static Canvas2D parity. `LcdLab.tsx` owns deterministic field and transport with scoped CSS. All material settings and art are baked into exported canvas, not CSS-only illusions.

## Deferred

No combined portrait/text thumbnail composer, animated video/GIF exports, or automatic cross-page image state. WFC is a collapsed static layout, not a fake time simulation. Icon animations remain in `/icons`.

## Answer

Implemented `/lcd`, linked all three experiment pages. All four algorithms, live DialKit settings, seeded transport/reset, editable material palettes and tinted/neutral shades, optional hero glyph, and exact local PNG snapshots are working. WFC uses lowest-domain entropy, seeded tie choices, adjacency propagation, bounded retries, and explicit contradictions; it never pretends a collapsed layout is a time simulation.

Validation: 244 unit tests; 40 LCD browser checks, 38 icon checks plus mobile navigation, 26 motion checks, and 35 portrait renderer checks pass. Typecheck/build pass with the pre-existing chunk-size advisory. PNG bytes match the visible canvas pixel-for-pixel; all shaded palettes and exact two-color Flat outputs tested. Desktop and 390px emulated mobile inspected. WCAG A/AA automated audit: zero violations; palette/DialKit contrast requires manual review. No physical-phone test.

Reset parity initially failed due to Chromium changing blur rounding when frequent readback migrated a GPU canvas to CPU. A minimized pure-render loop reproduced it without React. Requesting `willReadFrequently: true` from the first Canvas context creation pins the backend; six repeated render/readback assertions and seed-reset/fresh-export parity now pass. Headless DialKit popover QA flushes paint with a screenshot before selection, matching the existing background-tab testing caveat.
