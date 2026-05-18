# Highlighting Engine Refactor

## Goal

Deepen the commit highlighting system by consolidating the fragmented 4-tier verification logic into a single `HighlightingEngine` module. This will improve leverage for consumers (like `GitGraphViewProvider`) and ensure locality for verification rules and performance optimizations (caching, concurrency).

## Requirements

*   **Encapsulation**: Consolidate all 4 tiers of verification into a `HighlightingEngine` class.
    *   Tier 1 (Exact Hash) & Tier 2 (Signature) performed synchronously.
    *   Tier 3 (Full Patch-ID) & Tier 4 (PFM) performed asynchronously via a background queue.
*   **State & Cache Ownership**: The engine owns all caches (`branchSignaturesCache`, `patchIdCache`, `filePatchIdCache`) and handles their lifecycle (including invalidation when the target branch changes).
*   **Unified Interface**:
    *   `setTargetBranch(branchName: string)`: Sets the branch to compare against and resets relevant caches.
    *   `verifySync(commits: GitCommit[])`: Updates commits with Tier 1 & 2 results (`verified` or `pending`).
    *   `requestAsyncVerification(hash: string)`: Queues Tier 3 & 4 for a commit currently marked as `pending`.
    *   `onUpdate((hash, status) => void)`: Callback for async verification results.
*   **Performance**: Preserve the existing concurrency limit (3) and in-memory caching.

## Acceptance Criteria

*   [ ] `GitGraphViewProvider` no longer manages signature caches or orchestrates tiers manually.
*   [ ] `AsyncHighlightVerifier.ts` is replaced or encapsulated by the engine.
*   [ ] `commitHighlight.ts` logic is integrated into the engine or used internally.
*   [ ] Unit tests cover the full 4-tier flow within the new engine.
*   [ ] The webview's visibility-based triggering (`reverifyCommit`) continues to work via the new engine interface.

## Technical Approach

1.  **Create `src/git/HighlightingEngine.ts`**:
    *   Combine logic from `commitHighlight.ts` and `AsyncHighlightVerifier.ts`.
    *   Implement the background queue and cache management.
2.  **Refactor `GitGraphViewProvider`**:
    *   Remove `_branchSignaturesCache`, `_verifier`, and manual `applyHighlight`/`_reverifyCommit` logic.
    *   Initialize `HighlightingEngine` in the constructor.
    *   Call `engine.verifySync()` during refresh and `engine.requestAsyncVerification()` when receiving `reverifyCommit`.
3.  **Migration/Cleanup**:
    *   Update tests in `src/test/` to point to the new engine.
    *   Remove `src/git/AsyncHighlightVerifier.ts` and `src/git/commitHighlight.ts` if their logic is fully moved.

## Out of Scope

*   Pre-fetching or persistent caching.
*   Multi-branch comparison.
*   Changes to the core `git patch-id` or PFM algorithms.

## Technical Notes

*   Primary dependency: `GitService`.
*   Impacted files: `src/gitGraphView.ts`, `src/git/AsyncHighlightVerifier.ts`, `src/git/commitHighlight.ts`, `src/test/AsyncHighlightVerifier.test.ts`, `src/git/commitHighlight.test.ts`.
