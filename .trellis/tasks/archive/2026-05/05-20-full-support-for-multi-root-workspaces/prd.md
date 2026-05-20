# Full Support for Multi-root Workspaces

## Goal

Provide a seamless experience in multi-root workspaces by allowing users to manually switch the repository shown in the sidebar and ensuring that all commands operate on the correct repository context.

## What I already know

* `ViewDataManager` now supports multiple instances keyed by `cwd`.
* `GitGraphViewProvider` (sidebar) is currently locked to the first workspace folder.
* `getActiveManager()` resolves context based on the active editor but falls back to the first folder.

## Assumptions

* Users prefer manual control over which repository is shown in the sidebar in multi-root setups.
* A QuickPick interface is the most idiomatic way to select from multiple roots in VS Code.

## Requirements (final)

* **Repository Switcher**: Add a "Switch Repository" command (`git-wiz.switchRepository`) that displays a QuickPick of all workspace folders.
* **Dynamic Sidebar Update**: Update the sidebar `GitGraphViewProvider` to allow changing its target repository path without full disposal if possible, or by refreshing with a new `dataManager`.
* **Title Bar Integration**: Add the switch repository button to the sidebar view title bar.
* **Workspace Lifecycle**: Automatically dispose of `ViewDataManager` instances when workspace folders are removed using `vscode.workspace.onDidChangeWorkspaceFolders`.
* **Command Contextualization**: Ensure commands like Fetch, Pull, and Push triggered from the sidebar use the data manager of the *currently selected* repository in that sidebar.

## Acceptance Criteria

* [ ] A "Switch Repository" button appears in the Git Wiz sidebar header.
* [ ] Selecting a different root from the QuickPick updates the sidebar graph and branch list.
* [ ] The sidebar title reflects the name of the selected repository.
* [ ] All sidebar buttons (Fetch/Pull/Push) operate on the correctly selected repository.
* [ ] Removing a folder from the multi-root workspace cleans up its data manager.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes

## Out of Scope (explicit)

* Automatic switching based on active editor (requested manual-only for now).
* Displaying multiple repositories simultaneously.

## Technical Notes

* Impacted files: `src/extension.ts`, `src/views/ViewDataManager.ts`, `src/views/GitGraphViewProvider.ts`, `package.json`.
* VS Code API: `vscode.window.showQuickPick`, `vscode.workspace.onDidChangeWorkspaceFolders`.

## Decision (ADR-lite)

**Context**: Multi-root workspaces need a way to target specific repositories.
**Decision**: Implement a manual switcher (Option 1) via QuickPick and Sidebar Title integration.
**Consequences**: Gives users explicit control. Requires sidebar provider to handle dynamic path updates.
