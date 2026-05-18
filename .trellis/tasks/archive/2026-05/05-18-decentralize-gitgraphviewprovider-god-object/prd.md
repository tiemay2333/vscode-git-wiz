# Decentralize GitGraphViewProvider God Object

## Goal

Decompose the `GitGraphViewProvider` "God Object" into smaller, focused modules to improve testability, maintainability, and architectural depth. The provider should ideally focus on VS Code extension glue code, delegating state management and message routing to specialized modules.

## What I already know

* `GitGraphViewProvider` in `src/gitGraphView.ts` is currently responsible for:
    * VS Code Webview lifecycle management (`resolveWebviewView`).
    * Handling all incoming messages from the webview (`handleMessage`).
    * Managing the view state (filters, loaded commit count, search filters).
    * Coordinating Git services and highlighters.
* Current UI state managed by the provider:
    * `_filterBranch`, `_filterFile`, `_loadedCount`, `_searchFilters`.
* Previous refactor (CommitUIStatus separation) moved some complexity out of `GitCommit` but the logic for calculating it (`calculateUIStatus`) is still in the provider.

## Assumptions (temporary)

* Extracting state management into a `GraphState` class will allow testing search/filter logic without a VS Code environment.
* Extracting message handling into a `MessageDispatcher` or similar will reduce the size of the provider.
* We can use dependency injection to provide the `GitService` and `Webview` to these new modules.

## Open Questions

* [Preference] Should the new `GraphState` be a singleton or tied to the provider's instance? (Recommendation: Instance-based to support potential multiple webview panels in the future).
* [Preference] Should we use an Event-based system for state updates, or simple callback functions?

## Requirements (evolving)

* **Refactor State Management**: Create a `GraphState` module to hold and manage filters (`_filterBranch`, `_filterFile`), pagination (`_loadedCount`), and search filters (`_searchFilters`).
* **Refactor Message Routing**: Delegate message handling from `handleMessage` to specialized handlers (reusing or extending `GitCommandHandler`, `SettingsHandler`, etc., and creating a new `UIStateHandler`).
* **Clean up Provider**: Reduce `GitGraphViewProvider` to its essential VS Code responsibilities (webview lifecycle, configuration change listeners, file system watchers).
* **Maintain Logic**: Ensure all existing features continue to work without behavioral changes.

## Acceptance Criteria (evolving)

* [ ] `GitGraphViewProvider` file size is reduced.
* [ ] `GraphState` encapsulates all view-specific state.
* [ ] All existing commands and filters remain functional.
* [ ] Unit tests for Git services still pass.

## Technical Approach

### 1. `GraphState` Module
Create `src/graphState.ts` to manage the logical state of the graph view.
* Properties: `filterBranch`, `filterFile`, `loadedCount`, `searchFilters`.
* Methods: `reset()`, `updateFilters()`, `incrementPage()`.

### 2. UI Message Delegation
Instead of a giant switch in `GitGraphViewProvider`, delegate UI-specific messages (search, refresh, pagination) to a new `UIStateHandler` or similar lightweight helper.

### 3. Orchestration
`GitGraphViewProvider` will hold instances of `GraphState`, `GitCommandHandler`, `SettingsHandler`, etc., and act as the central dispatcher.

## Implementation Plan

* **Step 1**: Implement `GraphState` and migrate private state fields from `GitGraphViewProvider`.
* **Step 2**: Refactor `handleMessage` by extracting the `handleUIState` logic into a separate handler or method to reduce provider complexity.
* **Step 3**: Final integration and cleanup of the "God Object".

## Out of Scope

* Adding observer patterns or reactive state (beyond simple callbacks if needed).
* Addressing concurrent refresh logic (keep existing behavior).
