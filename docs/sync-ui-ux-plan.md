# Sync UI/UX improvement pass

This PR is the product/UI follow-up on top of the current sync implementation.

## Goal

Make sync feel like a natural part of the group instead of a technical side panel.

The intended experience is:

- simple
- calm
- obvious
- confidence-building
- usable by non-technical people

## Product problems seen in the current UI

### 1. Too much "panel/tool" feeling

Right now sync still reads like an advanced feature block.
It is functional, but not yet product-polished.

### 2. The main action is clearer than before, but the screen still carries technical weight

Even after moving to a single **Sincronitzar** action, the current surface still exposes:

- too much operational status text
- peer/runtime language too early
- a card that feels secondary instead of core

### 3. The sharing flow is useful but visually heavy

The copy-link step is important, but the current presentation can be simplified and made more guided.

### 4. Error and progress states can feel "engineering-first"

They are informative, but not yet framed in the most reassuring product language.

## Proposed UX direction

### A. One primary sync block, more like a guided action

Replace the current technical card feeling with a simpler flow:

- title: **Sincronitzar grup**
- one short explanation in plain language
- password input
- one clear primary action: **Sincronitzar**

### B. Progress should read like intent, not transport internals

Prefer messages like:

- "Preparant sincronització..."
- "Esperant l'altre dispositiu..."
- "Connectant dispositius..."
- "Posant dades al dia..."
- "Grup sincronitzat"

Avoid leading with low-level wording unless needed for diagnosis.

### C. Diagnostics move to a secondary/details area

Useful diagnostics should stay available, but visually demoted:

- last sync
- last error
- peers seen
- auto-retry active

This can live under a subtle "Detalls" / secondary section.

### D. Sharing should become a guided helper state

When the host is waiting:

- show one clear next step
- show the share-link button prominently
- reduce the wall of explanatory text

Example direction:

1. Prem **Copiar enllaç**
2. Obre'l a l'altre dispositiu
3. La sincronització començarà automàticament

### E. Completion should feel calm and definitive

After successful sync:

- concise success state
- short change summary if available
- one obvious close/finish action

### F. Sync should feel integrated with the group, not like a hidden admin area

This PR should explore whether the current placement and visual hierarchy are good enough,
or whether sync should feel more first-class inside the group experience.

## Scope for this UX PR

### In scope

- simplify visual hierarchy of the sync surface
- reduce technical wording in the main path
- improve waiting/share state
- improve success/error presentation
- move diagnostics to a clearly secondary area
- make the feature feel more polished and intentional

### Out of scope

- CRDT migration
- transport/protocol redesign
- auth/key-rotation redesign
- relay infrastructure

## Acceptance criteria

- a non-technical user can understand what to do in a few seconds
- the main path has one obvious action and one obvious next step
- transport details are not the first thing the user sees
- waiting, syncing, success and error states each have a clean presentation
- the screen feels product-level, not debug-level

## Suggested implementation slices

1. simplify copy and state labels
2. redesign waiting/share block
3. demote diagnostics into secondary UI
4. improve success/error layout
5. validate final polish in preview
