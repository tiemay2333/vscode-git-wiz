# Git Lean - GEMINI.md

## Project Overview

**Git Lean** is a minimalist Visual Studio Code extension for Git management. It focuses on a streamlined workflow, providing a side-by-side view of the branch list and a canvas-rendered commit graph.

- **Purpose:** Provide essential Git functionality (branching, commits, rebasing, squashing) without the bloat of traditional GUIs.
- **Main Technologies:** TypeScript, React 19 (Webview), VS Code Extension API, Canvas API (for graph rendering), esbuild (for webview bundling).
- **Architecture:**
  - **Extension Host (`src/*.ts`):** Handles VS Code API integration, command registration, and executes Git commands via `child_process`.
  - **Webviews (`src/webview/*.tsx`):** React-based UI for the branch panel and commit graph, communicating with the extension host via message passing.
  - **Git Operations (`src/gitOperations.ts`):** Wrappers for `git` CLI commands, including complex operations like programmatic interactive rebasing.
  - **Git Parser (`src/gitParser.ts`):** Pure functions for parsing `git log` output.

## Building and Running

The project uses `pnpm` for package management and `esbuild` for bundling webview assets.

- **Setup:** `pnpm install`
- **Full Build:** `pnpm run compile` (runs `tsc` and bundles the webview)
- **Watch Extension:** `pnpm run watch`
- **Watch Webview:** `pnpm run watch:webview`
- **Run Locally:** Open in VS Code and press `F5` (Extension Development Host).
- **Testing:** `pnpm run test` (uses Vitest for unit tests, primarily for the parser).
- **Linting:** `pnpm run lint` (ESLint)
- **Formatting:** `pnpm run format` (Prettier)

## Development Conventions

- **Surgical Updates:** When modifying the codebase, follow the existing patterns. `GitOperations.ts` is the central place for Git-related logic.
- **Git CLI usage:** The extension relies heavily on the `git` command-line tool. Ensure commands are compatible with standard Git versions.
- **Webview Communication:** Use `vscode.postMessage` for webview-to-extension communication and `webview.postMessage` for extension-to-webview updates.
- **Styling:** CSS is mostly handled in `src/webviewContent.ts` or inline in React components.
- **Interactive Rebase:** Complex operations like editing commit messages or squashing in the middle of history are performed by setting `GIT_SEQUENCE_EDITOR` and `GIT_EDITOR` to temporary Node.js scripts.

## Key Files

- `src/extension.ts`: Extension entry point and command registration.
- `src/gitOperations.ts`: Core Git logic and command execution.
- `src/gitParser.ts`: Git log output parsing logic.
- `src/webview/graph/GraphView.tsx`: Main React component for the commit graph.
- `src/webview/branches/BranchPanel.tsx`: Main React component for the branch management panel.
- `package.json`: Project metadata, dependencies, scripts, and VS Code contributions.
- `CONTRIBUTING.md`: Detailed setup and development instructions.