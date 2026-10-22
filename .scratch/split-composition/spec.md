# Split-layout composition lab

Type: task
Status: resolved

## Confirmed design

New separate `/compose` experiment combining the earlier labs. Left portrait cutout with a stepped pixel speech bubble above the head and a downward tail; top-right gameplay image pinned to corner with adjustable width/aspect/cover crop; bottom-right game title; bottom-left person nameplate or an attribution inside speech bubble (user confirmed a toggle). Procedural LCD patterns form the backdrop, with opaque panels clearing text areas.

Reference: `/Users/tug/Library/Application Support/com.raycast.macos/clipboard/file-42d7cfc006174d35ba262dcf313f24ce.png`.

**Negative type confirmed:** solid LCD screen-colored letter shapes on an opaque dark panel, NOT transparent glyph holes revealing the pattern. Crisp original pixel typography. Fit/wrap text, warn when truncated. Keep all output static at1280×720.

## Assets and controls

Upload pre-cut transparent portrait or send current treated portrait from Cutout Lab; transfer rendered with transparent background and saved locally in IndexedDB on explicit Send action. Composer can load/forget latest cutout; gameplay image is local and in-memory. Uploads resize/bound input sizes, auto-trim portrait transparent margins, handle failures without losing current assets. No second background-removal engine in composer.

DialKit for split/margins/bubble/tail/title geometry, portrait scale/offset/flip, gameplay aspect/width/zoom/pan, font scales, LCD material and procedural settings. Editable quote, person, role, game title. Optional color palettes including reference-like green and higher-contrast green. Exact current-preview PNG export. No automatic page-to-page portrait-state persistence without explicit Send.

## Validation plan

Pure bitmap type and crop/layout bounds tests; browser rendering checks for both attribution modes, real cutout transfer/trim/upload, gameplay cropping/aspect, negative lettering colors, procedural reset stability and PNG pixel parity; responsive layout and existing lab regressions. This is an experiment, not the final combined product.

## Answer

Implemented `/compose` with the confirmed layout and negative lettering. Solid panel ink and plain screen-colored bitmap glyphs are verified independent of procedural texture. Added original uppercase pixel font with fitting/wrapping, explicit name placement comparison, pinned aspect-aware gameplay crop, portrait scale/offset/flip, seeded LCD backdrops, and exact PNG export. Earlier labs retained and navigation expanded.

Cutout Lab now has Send cutout: render current treatment/outline with transparent background, commit one PNG to IndexedDB, then open Compose and trim alpha framing. No segmentation rerun or server upload. Direct gameplay and portrait uploads stay in memory. Forget action clears stored transfer. Failed uploads keep the current composition/export available.

Validation: 261 unit tests; 24 composition browser checks; 35 portrait, 38 icon, 26 motion, 40 LCD checks plus mobile navigation all pass. Typecheck/build pass, with pre-existing nonfatal chunk-size advisory. Tests exercise the actual Send button and cross-page navigation, transparency/alpha trim, gameplay upload/aspect, attribution switch round-trip, exact negative text colors and pattern isolation, repeated render stability, PNG pixel parity, transparent-image rejection, local asset deletion and mobile overflow. Desktop and emulated390px mobile inspected. Supplied real `artifacts/quality/quality.png` cutout also sent through the first lab and visually checked with a synthetic gameplay fixture; the default person/game names are placeholders, not claims about that photo. WCAG A/AA automated audit: zero violations; DialKit/palette contrast items require manual review. No physical-phone test.

QA fixture uploads use absolute file paths; relative paths through agent-browser's daemon caused NotReadableError despite valid PNGs. This was a harness path issue, not an app image decoder failure. Final browser suites pass with absolute paths.
