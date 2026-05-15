# brainstorm: Make HEAD branch leftmost lane in git graph

## Goal

Make the HEAD branch the main leftmost lane in the git graph visualization.

## What I already know

* The user wants to change the layout logic of the git graph.
* The current git graph logic is likely in `src/webview/graph/graphLayout.ts`.

## Assumptions (temporary)

* There is a way to identify which commits belong to the HEAD branch in the graph data.

## Open Questions


## Requirements (evolving)

* Identify commits on the HEAD branch.
* Ensure they are assigned to the leftmost lane (typically lane index 0).

## Acceptance Criteria (evolving)

* [x] The HEAD branch is drawn on the leftmost lane in the git graph.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)


## Technical Notes

