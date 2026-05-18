# Deepen GitCommit module by separating Domain and View concerns

## Goal

Separate the core Git data (Domain Model) from UI-specific state (View Model) in the `GitCommit` structure. This improves architectural depth, leverage, and testability by creating a clear "seam" between the Git backend and the webview frontend.

## What I already know

* `GitCommit` in `src/gitParser.ts` currently contains `isCurrentBranch` and `verificationStatus`, which are UI-specific.
* `GitGraphViewProvider` (Extension Host) currently pollutes these fields before sending data to the webview.
* The Webview (React) uses these fields for rendering high-level UI states (dimming, warning icons).
* Verification status (Tiers 3-4) is asynchronous and lazy-loaded via `IntersectionObserver` in `CommitRow.tsx`.

## Assumptions (temporary)

* Moving these fields out of `GitCommit` will require updating message types and state management in both Extension Host and Webview.
* Performance can be improved by using a Map for UI status instead of re-scanning/cloning the commit list on every update.

## Open Questions

* [Preference] Should the new UI state Map in the Webview be global to the `GraphView` or local to each `CommitRow`? (Recommendation: Global to `GraphView` for consistency and easier bulk updates).

## Requirements (evolving)

* Remove `isCurrentBranch` and `verificationStatus` from `GitCommit` interface in `src/gitParser.ts`.
* Define a `CommitUIStatus` interface/type for UI-specific state.
* Update `GitGraphViewProvider` to send pure `GitCommit` objects.
* Update `GitGraphViewProvider` to calculate initial UI status and send it as a separate `Record<string, CommitUIStatus>` in `replaceCommits` and `appendCommits` messages.
* Update Webview `GraphView` to manage a `Record<string, CommitUIStatus>` (keyed by commit hash).
* **Robustness (Memory Management)**: Ensure the `uiStatusMap` in the Webview is purged/reset when the commit list is replaced (e.g., on filter change or refresh) to prevent unbounded memory growth.
* Update `CommitRow` to receive `CommitUIStatus` as a prop instead of deriving it from the commit object.

## Acceptance Criteria (evolving)

* [ ] `GitCommit` interface is clean of UI properties.
* [ ] Commit highlighting (Tiers 1-4) still works correctly in the UI.
* [ ] Background verification updates the UI status Map without full list re-renders.
* [ ] The UI status Map is reset when the view is refreshed or filters are changed.
* [ ] Unit tests for `parseGitLogOutput` no longer need to consider UI fields.

## Technical Approach

### Backend (Extension Host)
1.  **Refactor `GitCommit`**: Remove UI fields from `src/gitParser.ts`.
2.  **Update `applyHighlight`**: Change it to `getInitialUIStatus(commits, currentBranch) -> Record<string, CommitUIStatus>`.
3.  **Message Schema**: Update `replaceCommits` and `appendCommits` to include a `uiStatus` field.

### Frontend (Webview)
1.  **State Management**: In `GraphView.tsx`, introduce `commitUIStatus` state.
2.  **Update Logic**:
    *   `replaceCommits`: Set `commitUIStatus` to the new Map (this provides the "automatic cleaning" by discarding the old Map).
    *   `appendCommits`: Merge the new UI status into the existing Map.
    *   `updateCommitHighlight`: Update only the specific hash in the Map.
3.  **Component Injection**: Pass `status={commitUIStatus[commit.hash]}` to `CommitRow`.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* Refactoring the entire `GitGraphViewProvider` "God object" (this is a separate deepening opportunity).
* Changing the core 4-tier verification logic itself.

## Technical Notes

* Files impacted: `src/gitParser.ts`, `src/gitGraphView.ts`, `src/webview/graph/GraphView.tsx`, `src/webview/graph/CommitRow.tsx`, `src/git/commitHighlight.ts`, `src/git/AsyncHighlightVerifier.ts`.
* Current `GitCommit` structure:
```typescript
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
    isCurrentBranch?: boolean;
    verificationStatus?: "pending" | "verified" | "failed";
}
```
