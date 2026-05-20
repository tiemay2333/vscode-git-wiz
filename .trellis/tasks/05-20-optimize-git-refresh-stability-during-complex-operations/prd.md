# Optimize Git Refresh Stability during Complex Operations

## Goal

Optimize the git refresh mechanism to handle complex operations (like rebase, merge, or cherry-pick) more gracefully. The goal is to ensure that the view only refreshes when the git repository is in a stable state (e.g., no `index.lock` exists).

## What I already know

* Current implementation uses a 500ms debounce timer in `ViewDataManager.ts`.
* File watchers monitor `.git/HEAD`, `.git/packed-refs`, and `refs/**`.
* Research indicates `.git/index.lock` is the most reliable "busy" signal.
* Rebase, Merge, Cherry-pick, and Revert have specific head files (`MERGE_HEAD`, `REVERT_HEAD`, etc.) and directories (`rebase-merge/`, `rebase-apply/`).

## Assumptions (temporary)

* `FileSystemWatcher` on `.git/index.lock` will reliably signal the start and end of most Git write operations.

## Open Questions

* None.

## Requirements (final)

* **Lock-Aware Refreshing**: Defer `refreshAll` calls if `.git/index.lock` exists. Trigger refresh immediately when the lock is released.
* **Expanded FS Watching**: Add `.git/index.lock`, `.git/MERGE_HEAD`, `.git/CHERRY_PICK_HEAD`, `.git/REVERT_HEAD`, and rebase directories (`rebase-merge/`, `rebase-apply/`) to the watcher list in `ViewDataManager`.
* **Atomic Trigger**: Ensure that if multiple events occur while locked, only one refresh is fired after the lock is released.

## Acceptance Criteria

* [ ] Refresh logic waits for `index.lock` to disappear before firing.
* [ ] No race conditions where a refresh happens during a rebase step.
* [ ] All new watchers are properly disposed of.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes

## Out of Scope (explicit)

* **UI Modifications**: No changes to the webview UI or status indicators.
* Full Git CLI implementation for every state.

## Technical Notes

* Impacted files: `src/views/ViewDataManager.ts`.
* Relevant Git paths to watch:
    * `.git/index.lock`
    * `.git/MERGE_HEAD`
    * `.git/CHERRY_PICK_HEAD`
    * `.git/REVERT_HEAD`
    * `.git/rebase-merge/**`
    * `.git/rebase-apply/**`

## Research References

* [`research/git-operation-detection.md`](research/git-operation-detection.md) — Detailed list of Git status indicators and locking mechanisms.

## Decision (ADR-lite)

**Context**: Frequent refreshes during multi-step Git operations cause flickering and inconsistent views.
**Decision**: Implement a lock-aware refresh mechanism that monitors `index.lock`.
**Consequences**: Improved stability and reduced redundant Git log calls during busy periods. No UI feedback was requested, so the user will simply see the view update once the operation finishes.
