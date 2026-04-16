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

## Other

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.