# Type Safety

> Type safety patterns in this project.

---

## Overview

- **TypeScript** throughout (both extension host and webview).
- **No runtime validation library** (no Zod, Yup, io-ts, etc.).
- Types are defined as **interfaces** (preferred) or `type` aliases.
- **Type-only imports** using `import type { ... }` for type-only references (enforced by a project eslint rule or convention).

---

## Type Organization

- **Shared types** crossing the extension-host boundary are defined in `gitParser.ts` (`GitCommit`) or `gitOperations.ts` (`Branch`) and re-exported.
- **Local types** are defined at the top of the file that owns them.
- **Window globals** for bootstrapped data are declared via `declare global { interface Window { ... } }` in `webview/index.tsx`.
- **Props interfaces** are co-located with their component (in the same file, near the top).

**Key type definitions:**

```typescript
// src/gitParser.ts
export interface GitCommit {
    hash: string;
    shortHash: string;
    message: string;
    date: string;
    timestamp: number;
    authorTimestamp: number;
    author: string;
    email: string;
    parents: string[];
    refs: string[];
    isCurrentBranch?: boolean;  // set during highlight pass
}

// src/gitOperations.ts
export interface Branch {
    name: string;
    fullName: string;
    isRemote: boolean;
    isHead: boolean;
    isTag: boolean;
}

// src/webview/graph/graphLayout.ts
export interface GraphNode {
    commit: GitCommit;
    x: number;
    color: number;
    lines: Array<{ x1: number; y1: number; x2: number; y2: number; color: number }>;
    maxTrack: number;
}
```

---

## Validation

- **No runtime validation.** Data from `git log` is parsed by `parseGitLogOutput()` and assumed to match the expected format.
- **Minimal defensive coding**: Empty results, null parents, missing files are handled with early returns/empty arrays, not validation.
- **Message data** from `postMessage` is typed via a `WebviewMessage` interface but not validated at runtime.

---

## Common Patterns

- **Type-only exports**: `export type { GitCommit } from "./gitParser"` — avoids emitting runtime code for re-exported types.
- **Discriminated unions**: Context menus use a tagged union type:
  ```typescript
  type CtxMenu
      = | { kind: "branch"; x: number; y: number; branch: Branch }
        | { kind: "multi"; x: number; y: number; branches: Branch[] }
        | { kind: "folder"; x: number; y: number; branches: Branch[]; folderKey: string };
  ```
- **Branded return types** in `createRoot`: Minimal typing — `const root = createRoot(container)` infers the type.
- **Type assertions** via `as` for CSS custom properties: `{ "--tree-level": level } as React.CSSProperties`.

---

## Forbidden Patterns

- **`any` type** — only used in `catch` clauses (`catch (err: any)`) and `JSON.stringify` contexts. All other `any` is forbidden.
- **`as` type assertions for data coercion** — data flowing from postMessage is used as-is; no type assertions on message payloads.
- **`// @ts-ignore` / `// @ts-expect-error`** — not found in the codebase; should not be added.
- **Non-null assertions (`!`)** — sparingly used (e.g., `vscode.workspace.workspaceFolders?.[0]!.uri.fsPath`). Prefer optional chaining and guard clauses.
