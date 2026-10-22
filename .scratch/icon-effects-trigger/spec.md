# Pronounced effects and immediate triggering

Type: task
Status: resolved

## Request

Glitch must be a full RGB chromatic glitch, not a muted monochrome shift. Make all effects more pronounced. Remove timeline/scrubbing; provide a button to trigger an effect immediately for visual verification.

## Implementation plan

Preserve LCD/backlit materials and clean exports. One-shot sampler: phase0 and1 are rest, active motion begins immediately after button press, lasts1.2 seconds at1×, then settles without looping. Trigger can restart a running effect. Keep speed control and reduced-motion/hidden-page safeguards. RGB glitch uses clearly separated color silhouettes and stepped band tears. Increase blink contrast, scan band width, hit flash/displacement, build reveal, and ghost trail travel/opacity. Test actual RGB raster regions, trigger/retrigger/settle, no timeline, and material/export regressions.

## Answer

Implemented immediate one-shot triggering without a timeline or autoplay. Trigger restarts an active effect; None/reduced-motion disable it. Added isolated additive screen blending for red/green/blue silhouettes, three stepped 2-cell tear patterns, stronger dim blink, occupied-block build reveal, broad scan highlight, bright hit flash/knockback, and two ghost trails. Rest returns at the end; materials and clean exports preserved.

Validation: 207 unit tests, 26 motion browser checks, 38 icon browser checks plus mobile navigation, typecheck/build pass. Actual raster checks verify distinct red, green, blue regions, not only SVG strings. Trigger/retrigger/completion/no-timeline/reduced-motion/mobile verified. RGB preview screenshot inspected at `artifacts/references/rgb-trigger.png`. Existing nonfatal build chunk-size advisory remains.
