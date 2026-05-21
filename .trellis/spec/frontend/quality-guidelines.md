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
- **Precise Git Watcher**: Avoid watching all of `.git/**`. Instead, watch specific paths: `.git/HEAD`, `.git/refs/heads/**`, `.git/refs/remotes/**`, `.git/refs/tags/**`, and `.git/packed-refs`.
- **Debounced refresh**: 500ms cooldown for filesystem watchers.
- **Resource Cleanup**: All `FileSystemWatcher` instances and timers MUST be added to `context.subscriptions` or explicitly disposed of in a `dispose()` method.
- **Webview Ready Signal**: Webviews must send a `ready` message upon mounting. The extension host must wait for this signal before sending any state updates (`replaceCommits`, `appendCommits`, etc.) to ensure messages are not lost during the initial load or re-render of the webview context.
- **Refresh Concurrency**: The `refresh()` method should implement a concurrency guard (e.g., `_refreshInProgress`) to prevent overlapping Git operations from multiple rapid events.
- **Handler-based message routing**: When a `WebviewViewProvider` or `WebviewPanel` grows a large `handleMessage` method, extract command groups into dedicated handler classes. Each handler receives only what it needs (service, callbacks), never the provider itself. All handlers implement `vscode.Disposable` so the provider can chain `dispose()` through them.
- **Provider State Management**: Do not manage complex asynchronous state (like refresh concurrency) using scattered boolean flags (e.g., `_refreshing`, `_pendingRefresh`) inside the `WebviewViewProvider`. Instead, encapsulate state coordination in a dedicated `RefreshManager` (or similar state machine) that supports request merging. This prevents race conditions and makes the provider's lifecycle predictable.

---

## Testing Requirements

- **Unit tests exist for `gitParser.ts` and `GitRunner.ts`** — the pure parsing and command-wrapping logic. Tests cover: empty input, single commit, merge commits, pipe characters in messages, multiple commits, root commits, whitespace trimming, tag refs.

---

## Code Review Checklist

1. **Are types correct?** No `any` (except catch/JSON.stringify), all interfaces explicit, `import type` used.
2. **Are side effects properly cleaned up?** Every `addEventListener` has a return-cleanup; every temp file (seq editor scripts) is `rmSync`'d; all `FileSystemWatcher` instances are disposed.
3. **Is there confirmation before destructive operations?** Revert, reset, delete, force push, drop, amend all prompt the user.
4. **Are error paths handled?** Git operations may fail — errors should be surfaced via `vscode.window.showErrorMessage`, not swallowed.
5. **Are CSP rules maintained?** The `nonce` pattern in `webviewContent.ts` must be preserved; no inline `<script>` tags without nonces.
6. **Is the refresh cycle correct?** After any git mutation, `this.onRefresh()` must be called to push state to the webview.
7. **Is Git watching precise?** Watcher avoids `.git/index` and objects to prevent infinite refresh loops during staging or background gc.
