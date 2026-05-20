# Transition to Controlled Multi-instance ViewDataManager

## Goal

Refactor `ViewDataManager` from a global singleton into a controlled multi-instance architecture. The current singleton implementation assumes a single `GitService` based on `vscode.workspace.workspaceFolders?.[0]`, which fundamentally prevents supporting multi-root workspaces or viewing different repositories in separate webview panels.

## What I already know

* `ViewDataManager.getInstance()` currently returns a single instance.
* It initializes a single `GitService`, `GitWorkflowEngine`, and `AsyncHighlightVerifier`.
* `extension.ts` and `GitGraphViewProvider.ts` directly call `ViewDataManager.getInstance()`.
* `GitService` defaults to the first workspace folder.

## Assumptions (temporary)

* We need a registry (e.g., `Map<string, ViewDataManager>`) to manage instances per repository path.
* `GitGraphViewProvider` will need to be associated with a specific repository path upon creation.

## Open Questions

* How should we determine the "active" repository if a user just runs "Git Wiz: Show Graph" without a specific file context?
* Should the registry live inside `ViewDataManager` (as static methods) or in a new `WorkspaceManager` class?

## Requirements (evolving)

* **Remove Singleton Pattern**: Deprecate/Remove `ViewDataManager.getInstance()`.
* **Instance Registry**: Implement a mechanism to retrieve or create a `ViewDataManager` for a specific URI or string path.
* **Explicit Pathing**: `GitService` and its dependencies must receive explicit repository paths, removing reliance on `workspaceFolders[0]`.
* **Provider Lifecycle**: Ensure `ViewDataManager` instances are disposed of correctly when a repository is removed from the workspace or when the extension is deactivated.

## Acceptance Criteria (evolving)

* [ ] `ViewDataManager` can instantiate multiple independent instances for different paths.
* [ ] No references to `ViewDataManager.getInstance()` remain in the codebase.
* [ ] The extension handles multi-root workspaces correctly (at least by allowing specific views per root).

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes

## Out of Scope (explicit)

* Overhauling the frontend UI to display multiple repositories in a single view. (This task is purely architectural preparation).

## Technical Notes

* Impacted files: `src/views/ViewDataManager.ts`, `src/views/GitGraphViewProvider.ts`, `src/extension.ts`.
