# State Management

> How state is managed in this project.

---

## Overview

- **No global state library.** React's `useState` is the only state mechanism.
- State flows **unidirectionally**: extension host → webview via `postMessage` commands.
- UI state is managed locally in each component. Shared state across views is co-located in the `GraphLayout` wrapper in `index.tsx`.
- Configuration state (user settings) lives in VS Code's `workspace.getConfiguration("git-wiz")`.

---

## State Categories

| Category | Location | Mechanism |
|---|---|---|
| **Commit data** | `window.__COMMITS__` / `GraphView` state | Bootstrapped JSON + `replaceCommits`/`appendCommits` messages |
| **Branch data** | `window.__BRANCHES__` / `BranchPanel` state | Bootstrapped JSON + `replaceBranches` messages |
| **Commit detail data** | `window.__COMMIT_DETAILS__` | Bootstrapped JSON (standalone panel) |
| **UI state** (selection, menus, search) | `useState` in `GraphView` / `BranchPanel` | Local React state |
| **Splitter position** | `vscode.getState`/`setState` | Persisted per-webview instance |
| **User settings** | `vscode.workspace.getConfiguration("git-wiz")` | VS Code configuration system |
| **Git config** | `git config` CLI commands | Read on demand, sent via messages |
| **File change detection** | `vscode.workspace.createFileSystemWatcher` | External, `.git/**` watcher triggers refresh |

---

## When to Use Global State

- **Never for component UI state.** Selection, menus, search filters, view modes are local.
- **Never for server/cache state.** No server state exists — all data is local git data.
- **Cross-view shared state** (branch <-> graph bridge) is handled in `extension.ts` by wiring `branchProvider.onBranchSelected` → `graphProvider.filterByBranch()`.

---

## Server State

- **No server state.** The extension operates entirely on local git repositories.
- The concept of "server state" doesn't apply — data is fetched from git via CLI on demand.

---

## Common Mistakes

- **Stale data after git operations**: After any git mutation (cherry-pick, rebase, merge, etc.), `this.onRefresh()` must be called to re-query and push updated state.
- **Debounced refresh**: `debouncedRefresh()` (500ms) on file system watcher prevents cascading refreshes when `.git/**` changes rapidly.
- **Initialization race**: The `_initialized` flag + `_pendingRefresh` pattern prevents refreshes before the webview is ready.
- **Search and pagination don't mix well**: When search filters are active, `_searchFilters` is set and subsequent `loadMoreCommits` includes the filter. Clear filters to see all commits again.
