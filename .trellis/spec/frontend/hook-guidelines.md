# Hook Guidelines

> How hooks are used in this project.

---

## Overview

- **No custom hooks extracted** — all state logic is embedded directly in components.
- Standard React hooks only: `useState`, `useCallback`, `useEffect`, `useMemo`, `useRef`, `useLayoutEffect`.
- React 19 APIs: `createRoot` from `react-dom/client`.

---

## Custom Hook Patterns

Custom hooks are **not used in this project**. Stateful logic is kept inline in components for simplicity. When a piece of logic is reusable (e.g., `buildFileTree`), it is extracted as a **pure function** rather than a hook.

If a custom hook were needed, it would:
- Be named `use*` (e.g., `useCommitSelection`).
- Return a tuple or object with state + handlers.
- Live in the feature directory or a shared `hooks/` directory.

---

## Data Fetching

- **No React Query, SWR, or similar.** Data flows one-way from extension host to webview via `postMessage`.
- Initial data is bootstrapped as JSON in `window.__*__` globals.
- Subsequent updates arrive as postMessage commands (`replaceCommits`, `appendCommits`, `replaceBranches`).
- Loading states: `isLoadingMore` for pagination; `loadingHash` for individual commit file loading.

---

## Naming Conventions

- **All hooks follow `use*` naming**, as required by the Rules of Hooks.
- State setters: `set*` derived from state variable name.
- Ref variables: `*Ref` suffix (e.g., `containerRef`, `ctxMenuRef`).
- Cached refs for avoiding stale closures: `*Ref` mirroring a state variable (e.g., `commitsRef`, `selectedIndicesRef`).

---

## Common Mistakes

- **Not updating refs on every render**: Refs must be synced in `useEffect`/`useLayoutEffect` or inline `useRef` assignment to avoid stale values. Pattern in the codebase:

  ```tsx
  const commitsRef = useRef(commits);
  useEffect(() => { commitsRef.current = commits; });
  ```

- **Forgetting cleanup on event listeners**: Every `window.addEventListener` in `useEffect` must return a cleanup function that calls `removeEventListener`.

- **Using `useEffect` for layout calculations**: `useLayoutEffect` is the correct choice when reading DOM positions (context menu positioning, scroll-to-top).
