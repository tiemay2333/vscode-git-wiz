# Transition to Controlled Multi-instance ViewDataManager

## Goal

Refactor `ViewDataManager` from a global singleton into a controlled multi-instance architecture. The current singleton implementation assumes a single `GitService` based on `vscode.workspace.workspaceFolders?.[0]`, which fundamentally prevents supporting multi-root workspaces or viewing different repositories in separate webview panels.

## What I already know

* `ViewDataManager.getInstance()` currently returns a single instance.
* It initializes a single `GitService`, `GitWorkflowEngine`, and `AsyncHighlightVerifier`.
* `extension.ts` and `GitGraphViewProvider.ts` directly call `ViewDataManager.getInstance()`.
* `GitService` defaults to the first workspace folder.

## Assumptions

* We need a registry (e.g., `Map<string, ViewDataManager>`) to manage instances per repository path.
* `GitGraphViewProvider` will need to be associated with a specific repository path upon creation.

## Requirements (final)

* **Remove Singleton Pattern**: Remove `ViewDataManager.getInstance()`.
* **Instance Registry**: Implement a static registry inside `ViewDataManager` to cache instances keyed by repository path (`static getManagerForPath(cwd: string)`).
* **Explicit Pathing**: The entry points in `extension.ts` must resolve the appropriate repository path before initializing a `GitGraphViewProvider` or calling a Git workflow.
* **Active Repository Resolution**: Implement a helper function to determine the "active" repository (priority: active text editor -> active graph view provider -> first workspace folder).
* **Workspace Changes**: Listen for `vscode.workspace.onDidChangeWorkspaceFolders` to handle added/removed workspace roots appropriately (dispose managers for removed roots).

## Acceptance Criteria

* [ ] `ViewDataManager` manages multiple independent instances keyed by repository path.
* [ ] No references to `ViewDataManager.getInstance()` remain.
* [ ] Commands (like "Show File History", "Show Graph", "Cherry-pick") correctly resolve the repository path and use the corresponding data manager.
* [ ] Multi-root workspaces function without state clashing between roots.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes

## Out of Scope (explicit)

* Overhauling the frontend UI to display multiple repositories in a single view. (This task is purely architectural preparation).

## Technical Notes

* Impacted files: `src/views/ViewDataManager.ts`, `src/views/GitGraphViewProvider.ts`, `src/extension.ts`.

## Decision (ADR-lite)

**Context**: Singleton `ViewDataManager` prevents proper multi-root workspace support.
**Decision**: Implement a static registry within `ViewDataManager` (`getManagerForPath`) and pass specific paths to it. Introduce `WorkspaceManager` or a helper to resolve the active context path.
**Consequences**: Eliminates global state clashes. Commands must now explicitly declare which repository they are operating on.
