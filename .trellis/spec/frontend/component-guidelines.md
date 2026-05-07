# Component Guidelines

> How components are built in this project.

---

## Overview

- **Framework**: React 19 with hooks (no class components).
- **All components** are functional components using hooks for state and side effects.
- **No external component libraries** — only React DOM. UI is built from scratch with VS Code theme CSS variables.
- **No routing library** — view routing is done via `__VIEW__` window global (`"graph"` | `"commitDetails"` | `"branches"`).
- **Large components** are kept in single files with internal sub-components (e.g., `GraphView.tsx` contains `FileTree`, `FileList`, `FileTreeNode`).

---

## Component Structure

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Props {
    // typed props
}

export function ComponentName({ prop1, prop2 }: Props) {
    // 1. State declarations (useState)
    // 2. Refs (useRef)
    // 3. Complex derived state (useMemo)
    // 4. Side effects (useEffect / useLayoutEffect)
    // 5. Event handlers (useCallback)
    // 6. Render

    return (/* JSX */);
}
```

---

## Props Conventions

- Props are typed with **interfaces** (preferred) or inline `type`.
- Props are **destructured** in the function signature.
- Boolean props use simple names: `showTags`, `isSelected`, `isLoading`, `hasMore`.
- Event handler props are named `onEvent`: `onClick`, `onEditConfirm`, `onContextMenu`, `onOpenDiff`.
- Optional props use `?:` with sensible defaults in the destructuring.

```tsx
interface Props {
    graphWidth: number;
    showGraph?: boolean;            // optional, defaults handled
    onClick: (shiftKey: boolean) => void;  // typed callback
}
```

---

## Styling Patterns

- **No CSS modules, styled-components, or Tailwind.** All styles are inline `<style>` tags in the HTML template (`webviewContent.ts`).
- **VS Code theme variables** are used throughout: `var(--vscode-foreground)`, `var(--vscode-editor-background)`, `var(--vscode-list-hoverBackground)`, etc.
- Inline styles via React `style` prop for dynamic values (e.g., `{{ width: graphWidth }}`, `{{ "--tree-level": level } as React.CSSProperties}`).
- CSS class toggling via string concatenation: `[isSelected ? "row-selected" : ""].filter(Boolean).join(" ")`.
- Minimal transitions: `0.15s ease` for hovers, `0.2s` for details accordion.

---

## Accessibility

- **No explicit ARIA attributes.** The extension targets VS Code users (developers) — accessibility relies on VS Code's built-in theming and keyboard navigation.
- Keyboard handlers: `onKeyDown` for Enter/Escape on inputs, modal close on Escape.
- Semantic HTML: `<table>` for commit data, `<button>` for clickable actions, `<label>` for form controls.
- Color contrast is delegated to VS Code theme variables.

---

## Common Mistakes

- **Missing deps in hooks**: Every `useEffect`, `useCallback`, `useMemo` must list all reactive dependencies. The codebase uses `eslint-plugin-react-hooks`.
- **Stale closures**: Fixed by using `useRef` to cache mutable values (`commitsRef`, `selectedIndicesRef`) when callbacks need the latest state without re-creating.
- **Inline SVGs as `dangerouslySetInnerHTML`**: The codebase uses JSX SVG elements instead (correct).
- **Context menu positioning**: Must clamp to viewport bounds — a `useLayoutEffect` recalculates `left`/`top` to prevent overflow.
