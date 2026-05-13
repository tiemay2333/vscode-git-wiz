# brainstorm: Remove amend commit related features

## Goal

Remove all "amend commit" functionality from the GitWiz VS Code extension to streamline the feature set or because it's no longer desired.

## What I already know

* The "amend commit" feature currently exists as a context menu item in the graph view (`GraphView.tsx`).
* It posts an `amendCommit` message to the extension host (`gitGraphView.ts`).
* The host then executes the `git commit --amend --no-edit` command via `gitOperations.ts` after prompting the user for confirmation.

## Open Questions

* None at the moment.

## Requirements (evolving)

* Remove "Amend Commit" option from the context menu in `GraphView.tsx`.
* Remove `amendCommit` message handling in `gitGraphView.ts`.
* Remove the `amendCommit()` function from `gitOperations.ts`.

## Acceptance Criteria (evolving)

* [ ] The user can no longer see "Amend Commit" in the UI.
* [ ] The codebase no longer contains unused `amendCommit` functions.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes

## Out of Scope (explicit)

* Other Git operations like Cherry Pick, Drop, Rebase.

## Technical Notes

* `src/webview/graph/GraphView.tsx` (Context Menu)
* `src/gitGraphView.ts` (Message switch case)
* `src/gitOperations.ts` (`amendCommit` method)
