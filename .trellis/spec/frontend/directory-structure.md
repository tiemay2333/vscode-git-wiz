# Directory Structure

> How frontend code is organized in this project.

---

## Overview

This project is a VS Code extension ("Git Wiz") for branch management and commit graph visualization. It follows the **two-process VS Code extension model**: extension host (Node.js) + webview UI (React 19).

The frontend (webview) code lives entirely under `src/webview/`. The extension host code lives directly under `src/`.

---

## Directory Layout

```
src/
├── extension.ts                # Entry point: activates extension, registers commands
├── gitOperations.ts            # All git CLI wrappers (cp.exec/cp.execFile)
├── gitParser.ts                # Pure function parseGitLogOutput — parses git log output
├── gitGraphView.ts             # WebviewViewProvider: graph + branch views, message handling
├── webviewContent.ts           # HTML generation with inline CSS + CSP
├── test/
│   └── gitParser.test.ts       # Vitest unit tests for gitParser
└── webview/
    ├── index.tsx               # React root: routing by view type (graph/commitDetails/branches)
    ├── vscodeApi.ts            # acquireVsCodeApi wrapper (singleton)
    ├── settings/
    │   └── SettingsForm.tsx    # Settings modal: toggles, git config, remotes
    ├── graph/
    │   ├── GraphView.tsx       # Main graph view: table, search, context menus, file tree/list
    │   ├── CommitRow.tsx       # Single commit row component (React.memo)
    │   └── graphLayout.ts      # Canvas graph layout algorithm (pure function)
    ├── commitDetails/
    │   └── CommitDetailsView.tsx  # Standalone commit detail panel with patch diff
    └── branches/
        └── BranchPanel.tsx     # Branch tree view with sections (local/remote/tags)
```

---

## Module Organization

- **Extension host** (`src/`): One file per concern — entry point (`extension.ts`), git operations (`gitOperations.ts`), git parsing (`gitParser.ts`), view provider (`gitGraphView.ts`), HTML template (`webviewContent.ts`).
- **Webview** (`src/webview/`): Grouped by UI feature — `graph/`, `branches/`, `commitDetails/`, `settings/`. Each feature directory contains a single main component file.
- **Shared/Across**: Types that cross the extension-host boundary are defined in `gitParser.ts` (`GitCommit`) or `gitOperations.ts` (`Branch`) and re-exported.
- **Tests**: Co-located under `src/test/`, mirrors the source structure with `.test.ts` suffix.

---

## Naming Conventions

- **Files**: PascalCase for components (`GraphView.tsx`), camelCase for utilities (`graphLayout.ts`, `vscodeApi.ts`).
- **Commands**: kebab-case prefixed with `git-wiz.` (e.g., `git-wiz.showGraph`, `git-wiz.cherryPick`).
- **Message commands**: camelCase (e.g., `replaceCommits`, `loadMoreCommits`).
- **Window globals**: UPPER_SNAKE_CASE with double-underscore prefix/suffix (`__COMMITS__`, `__HAS_MORE__`).
- **CSS classes**: kebab-case (`row-selected`, `context-menu-item`, `file-tree-node`).

---

## Examples

Well-organized modules:
- `src/webview/graph/` — contains the graph view component, its row sub-component, and the pure layout algorithm in separate files by responsibility.
- `src/webview/branches/` — a single self-contained component with inline icon components and tree-building logic.
