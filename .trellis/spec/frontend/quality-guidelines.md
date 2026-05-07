# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

- **Minimalist philosophy**: no unnecessary dependencies, no speculative abstractions, no UI bloat.
- Runtime dependencies: `react` and `react-dom` only. All other functionality uses VS Code API, Node built-ins, or git CLI.
- **No configuration UI**: settings are accessed through the gear icon in the graph view, not a separate settings page.

---

## Forbidden Patterns

- **`any` type** (except `catch` clauses and `JSON.stringify`).
- **Class components** — all components must be functional with hooks.
- **External runtime dependencies** beyond React/ReactDOM. No lodash, moment.js, axios, etc.
- **CSS-in-JS libraries** — use inline `<style>` tags with VS Code theme variables, not styled-components or emotion.
- **Git libraries** (libgit2, isomorphic-git, etc.) — all git operations go through the `git` CLI.
- **Bare `cp.exec` with user input** — command arguments should be properly escaped or use `cp.execFile` with argument arrays. `cp.exec` is only used for simple commands where arguments are controlled.
- **`window.__*__` assignments outside `webviewContent.ts`** — bootstrapped globals should only be set in the HTML template.

---

## Required Patterns

- **`import type`** for type-only imports (enforced by eslint).
- **`cp.execFile` over `cp.exec`** for git commands with external data — prevents shell injection.
- **`vscode.window.withProgress`** for any operation that may take > 1 second (fetch, push, rebase, etc.).
- **Confirmation dialogs** for destructive operations — `vscode.window.showWarningMessage` for revert, reset, delete, force push, drop, etc.
- **Debounced refresh** (500ms) when watching `.git/**` file changes.

---

## Testing Requirements

- **Unit tests exist for `gitParser.ts`** — the only pure function in the codebase. Tests cover: empty input, single commit, merge commits, pipe characters in messages, multiple commits, root commits, whitespace trimming, tag refs.
- **No component or integration tests.** The webview UI is not tested in isolation.
- **Manual testing** is done via F5 launch in VS Code Extension Development Host.
- **Test command**: `pnpm run test` (vitest) — runs before changes are submitted.

---

## Code Review Checklist

1. **Are types correct?** No `any` (except catch/JSON.stringify), all interfaces explicit, `import type` used.
2. **Are side effects properly cleaned up?** Every `addEventListener` has a return-cleanup; every temp file (seq editor scripts) is `rmSync`'d.
3. **Is there confirmation before destructive operations?** Revert, reset, delete, force push, drop, amend all prompt the user.
4. **Are error paths handled?** Git operations may fail — errors should be surfaced via `vscode.window.showErrorMessage`, not swallowed.
5. **Are CSP rules maintained?** The `nonce` pattern in `webviewContent.ts` must be preserved; no inline `<script>` tags without nonces.
6. **Is the refresh cycle correct?** After any git mutation, `this.onRefresh()` must be called to push state to the webview.
