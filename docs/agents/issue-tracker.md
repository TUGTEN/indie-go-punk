# Issue tracker: Local Markdown

Issues and specs live in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- Spec: `.scratch/<feature-slug>/spec.md`
- One file per implementation ticket:
  `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`.
- Record triage state as a `Status:` line near the top.
  Use the strings in `triage-labels.md`.
- Append conversation under `## Comments`.

## Publishing and fetching

When publishing, create the appropriate spec or ticket file.
When fetching, read the referenced ticket path.

## Wayfinding operations

- Map: `.scratch/<effort>/map.md`, containing Notes,
  Decisions-so-far, and Fog.
- Child tickets: `.scratch/<effort>/issues/NN-<slug>.md`.
  Put the question in the body.
- Record `Type:` as research, prototype, grilling, or task.
- For wayfinding, use `Status: claimed` or `Status: resolved`.
- Record dependencies as `Blocked by: NN, NN`.
  A ticket is unblocked when all listed tickets are resolved.
- Pick the first numbered open, unblocked, unclaimed ticket.
- Claim by saving `Status: claimed` before working.
- Resolve by appending `## Answer`, setting `Status: resolved`,
  and adding a summary and ticket link to the map's Decisions-so-far.
