# brainstorm: Fix stale commit list after reopen

## Goal

Ensure the commit list and branch filter are correctly reset when the Git Wiz webview is closed and reopened, preventing it from showing stale data from a previous state.

## What I already know

*   When the webview is disposed in `resolveWebviewView`, `_initialized` is set to `false`, and `_filterBranch` / `_filterFile` are reset to `null`.
*   However, `_loadedCount` and `_searchFilters` are NOT reset.
*   If `_loadedCount` remains large from a previous session, the next `refresh()` will try to load that many commits.
*   The webview might be caching its internal state via `vscode.getState()`.

## Assumptions (temporary)

*   The user expects a fresh view (current branch, first page of commits, no filters) when they close and reopen the panel.
*   The `resolveWebviewView` cleanup logic is incomplete.

## Open Questions

*   Should we also reset `_searchFilters`? (Likely yes)
*   Should we reset `_loadedCount` to `0` or `PAGE_SIZE`? (Resetting to `0` and letting `refresh` handle the load is safer)

## Requirements (evolving)

*   Reset `_loadedCount` to `0` when the webview is disposed.
*   Reset `_searchFilters` to `undefined` when the webview is disposed.
*   Ensure the webview frontend doesn't restore a stale commit list from `vscode.getState()` if we want a fresh start (though `vscode.getState()` usually persists across visibility changes but maybe not across full disposal of the `WebviewView`).

## Acceptance Criteria (evolving)

* [ ] Closing the Git Wiz panel and reopening it results in a fresh load of the current branch's commits.
* [ ] Filters (branch, file, search) are cleared upon reopening after a full disposal.

## Definition of Done (team quality bar)

* Verified manually in VS Code (close/reopen view).
* Lint / typecheck pass.

## Technical Notes

*   Modified file: `src/gitGraphView.ts` (specifically `resolveWebviewView` dispose handler).
*   Check if `vscode.getState()` in `src/webview/index.tsx` needs adjustment (it currently only seems to store `leftWidth`).
