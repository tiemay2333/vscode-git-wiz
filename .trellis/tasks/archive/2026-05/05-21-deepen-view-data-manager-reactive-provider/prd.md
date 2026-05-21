# Deepen ViewDataManager and Make Provider Reactive

## Goal

Deepen the `ViewDataManager` (VDM) module by moving data fetching, caching, and UI-specific state transformation logic out of `GitGraphViewProvider`. This will turn VDM into a high-leverage "View State Engine" that provides high-level data snapshots to the Provider, making the Provider more reactive and focused on view lifecycle management.

## What I already know

* `GitGraphViewProvider` currently performs complex data fetching via `GitService` and transforms it into `ToWebviewMessage` structures.
* Methods like `_doRefresh`, `loadMoreCommits`, and `requestUnfilteredCommits` in `GitGraphViewProvider` leak domain knowledge about how to assemble UI data.
* `ViewDataManager` was recently refactored to expose `history`, `refs`, `ops`, `files`, and `config` domains, but it's still mostly a pass-through for these sub-services.
* There is a `RefreshManager` used by the Provider, but its logic might overlap with what VDM could handle.

## Assumptions (temporary)

* VDM can maintain a "Current View State" that includes commits, branches, current branch, and UI status (highlighting, etc.).
* Moving logic to VDM will make it easier to unit test the data-assembly logic without mocking the entire Webview infrastructure.

## Open Questions

* Should VDM emit a single "Data Snapshot" event, or separate events for different types of data?
* How should we handle "Load More" (pagination) in a reactive model? Does VDM manage the loaded count?

## Decision (ADR-lite)

**Context**: `GitGraphViewProvider` currently orchestrates data fetching, pagination, and UI transformation, leading to logic leakage and hard-to-test code.
**Decision**: Transform `ViewDataManager` (VDM) into a full **View State Engine**. VDM will own the `GraphState` and `UIConverter` logic, handle its own refresh flow-control (absorbing `RefreshManager` concepts), and provide high-level `ViewDataSnapshot` objects to the UI.
**Consequences**: The Provider becomes a reactive "pipe". Testability increases significantly as data assembly can be unit-tested in isolation.

## Requirements (evolving)

* [ ] **State Consolidation**: Move `GraphState` (filters, pagination) into VDM.
* [ ] **Logic Downward Migration**:
    *   Move `loadMoreCommits`, `_doRefresh`, and `requestUnfilteredCommits` logic from `GitGraphViewProvider` to VDM.
    *   Integrate `UIConverter` logic into VDM for computing commit highlights/statuses.
* [ ] **Flow Control Absorption**: Incorporate `RefreshManager`'s debouncing and initialization-gating logic directly into VDM.
* [ ] **Snapshot Interface**: Define `ViewDataSnapshot` containing commits, branches, UI statuses, and view-related metadata.
* [ ] **Reactive Event**: Implement `onDidUpdateSnapshot` in VDM.
* [ ] **Provider Slimming**: Refactor `GitGraphViewProvider` to reactively push VDM snapshots to the webview.

## Acceptance Criteria (evolving)

* [ ] `GitGraphViewProvider` has < 50% of its original lines for data management.
* [ ] Webview correctly reflects filters, pagination, and branch highlights via VDM snapshots.
* [ ] Switching between multiple repository instances maintains their respective view states (filters, scroll position hints).
* [ ] Unit tests for VDM cover a full data assembly cycle (filter change -> snapshot update).

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* Changing the Webview's React implementation (this is a backend-for-frontend refactor).
* Refactoring the internal Git logic of sub-services.

## Technical Notes

* Core files: `src/views/ViewDataManager.ts`, `src/views/GitGraphViewProvider.ts`, `src/views/dataManager/IViewDataManager.ts`.
* Relevant patterns: Observer pattern, State management.
