# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm install              # setup
pnpm run compile          # full build: tsc + esbuild webview bundle
pnpm run watch            # watch extension source (tsc -watch)
pnpm run watch:webview    # watch webview source (esbuild --watch)
pnpm run test             # run vitest unit tests
pnpm run lint             # eslint src
pnpm run lint:fix         # eslint src --fix
pnpm run format           # prettier --write src
pnpm run format:check     # prettier --check src
```

Press **F5** in VS Code to launch the Extension Development Host.

- Node >= 24, pnpm >= 10
- Tests live at `src/test/` (vitest, glob pattern `src/**/*.test.ts`). `pretest` runs `compile` first.
- Webview is bundled via esbuild to `out/webview/index.js` (IIFE, ES2020, JSX automatic, minified). The extension host TypeScript is compiled by `tsc` to `out/`.

## Architecture

This is a VS Code extension ("Git Wiz") providing a branch panel and canvas-rendered commit graph.

**Two-process model:**

- **Extension host** (`src/*.ts`) — registers commands, spawns `git` via `child_process`, manages webview views. Entry point: `src/extension.ts`.
- **Webview UI** (`src/webview/*.tsx`) — React 19, bundled separately by esbuild. Renders branch panel, commit graph, and commit details. Communicates with the host via `vscode.postMessage` / `webview.postMessage`.

**Data flow:** The extension host serializes initial data into `window.__COMMITS__`, `window.__BRANCHES__`, etc. as JSON in the HTML template (`src/webviewContent.ts`). The React app hydrates from these globals (`src/webview/index.tsx`). Subsequent updates flow as postMessage commands (`replaceCommits`, `appendCommits`, `replaceBranches`).

**Key source files:**

| File | Role |
|---|---|
| `src/extension.ts` | Entry point: activates extension, registers all commands, wires providers together |
| `src/gitOperations.ts` | All `git` CLI wrappers. Uses `cp.exec`/`cp.execFile`. Complex operations (amend non-HEAD, squash mid-history) use `GIT_SEQUENCE_EDITOR`/`GIT_EDITOR` env vars pointing to temp Node scripts. Also acts as the shared GitCommit type source. |
| `src/gitParser.ts` | Pure function `parseGitLogOutput` that splits pipe-delimited `git log --pretty=format:"%H|%h|%P|%an|%ae|%ai|%D|%ct|%s"` output into `GitCommit[]`. Unit tested. |
| `src/gitGraphView.ts` | `WebviewViewProvider` for the Graph view. Handles search, pagination (PAGE_SIZE=200), infinite scroll, commit operations, and file diffing. Also supports a standalone `WebviewPanel` via `createOrShow`. |
| `src/branchWebviewProvider.ts` | `WebviewViewProvider` for the Branches view. Renders local/remote/tag sections. Delegates branch operations to registered commands. |
| `src/webviewContent.ts` | Generates the full HTML for graph and commit-detail views (inlines CSS, bootstraps JSON data, sets CSP with nonce). |
| `src/webview/graph/GraphView.tsx` | Main React component for the commit graph. Manages selection state, context menus (single/range), search filters, file tree/list views, and infinite scroll. |
| `src/webview/graph/graphLayout.ts` | Canvas graph layout algorithm — assigns commits to tracks, computes SVG line coordinates for merge visualization. |
| `src/webview/graph/CommitRow.tsx` | Single row: SVG graph cell + message + ref badges + hash + author + date. Supports inline editing. |
| `src/webview/branches/BranchPanel.tsx` | Branch panel React component. Tree rendering with collapsible groups (prefix-based), multi-select with Shift/Ctrl, context menus, tag display. |
| `src/webview/commitDetails/CommitDetailsView.tsx` | Commit detail view for the standalone panel — metadata, patch parsing, file tree/list with inline diffs. |

**Webview message protocol:** The webview sends commands like `search`, `getCommitFiles`, `cherryPick`, `squashCommits`, `checkoutBranch`, `deleteBranch`, etc. The host responds with `replaceCommits`, `appendCommits`, `replaceBranches`, `commitFilesData`.

**Git watchers:** Both `GitGraphViewProvider` and `BranchWebviewProvider` watch `.git/**` via `vscode.workspace.createFileSystemWatcher` and debounce refreshes (500ms).

**Branch-to-graph bridge:** When a branch is selected in the branch panel, `extension.ts` wires `branchProvider.onBranchSelected` to `graphProvider.filterByBranch()`, which re-queries `git log` scoped to that branch.

## Conventions

- **Minimalist design** — no UI bloat, no settings pages, no unnecessary dependencies. The only runtime dependencies are `react` and `react-dom`.
- **No external runtime deps** unless strictly justified. The extension uses only Node built-ins and the VS Code API at runtime.
- **Surgical changes** — match existing patterns, don't refactor adjacent code, don't introduce abstractions for single-use code.
- **Git CLI only** — the extension never uses a Git library; all operations go through the `git` binary. This keeps the extension lightweight and avoids libgit2 compatibility issues.
- **CSP in webviews** — content security policy uses nonces for scripts and `'unsafe-inline'` for styles.
- **Typography** — the project uses a specific CSS approach: `font-weight: 500` or `600` on body, tabular-nums for hashes/dates, `-webkit-font-smoothing: antialiased`, letter-spacing on uppercase labels.
