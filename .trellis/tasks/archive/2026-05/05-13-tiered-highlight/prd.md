# brainstorm: Implement tiered branch highlighting logic

## Goal

Implement a robust, efficient, and user-friendly branch highlighting logic using a tiered approach. This will accurately identify cherry-picked commits using `numstat` and `patch-id` while maintaining UI responsiveness through asynchronous background verification.

## Requirements

1.  **Tiered Verification Engine**:
    *   **Tier 1 (Instant)**: Metadata-based matching (Subject + Email + Timestamp).
    *   **Tier 2 (Async)**: Fingerprint validation via `git show --numstat` (File list + line counts).
    *   **Tier 3 (Async)**: Content-based validation via `git patch-id`.
2.  **UI Feedback (Scheme C)**:
    *   Commits identified by Tier 1 but not yet verified will show a yellow question mark icon.
    *   Icon SVG: Provided by user (yellow circle with question mark).
    *   Tooltip: "Current Branch Matching: Metadata matched, verifying content similarity..." (or localized equivalent).
    *   Verified commits (Tier 2/3 success): Remove icon, show full highlight.
    *   Failed verification: Remove highlight and icon.
3.  **Concurrency Control**:
    *   Implement a worker queue for background verification (max 3 parallel processes) to prevent git command storms.
4.  **Messaging Layer**:
    *   Extension must push `updateCommitHighlight` messages to the webview as results come in.

## Acceptance Criteria

*   [ ] Metadata-matched commits immediately show "Pending" state (icon + highlight).
*   [ ] Yellow question mark icon displays a helpful tooltip on hover.
*   [ ] Successfully verified commits upgrade to "Verified" state (no icon, full highlight).
*   [ ] Incorrectly matched commits lose their highlight state after verification fails.
*   [ ] Unit tests updated to handle `verificationStatus`.

## Technical Approach

*   **src/gitOperations.ts**: Implement `getNumstat` and `getPatchId`.
*   **src/gitGraphView.ts**:
    *   Add `AsyncHighlightVerifier` class.
    *   Update `applyHighlight` to trigger the verification queue.
*   **src/webview/graph/CommitRow.tsx**:
    *   Render the SVG icon if `verificationStatus === 'pending'`.
    *   Add `title` attribute for the tooltip.
*   **src/gitParser.ts**: Add `verificationStatus` property to `GitCommit` interface.

## Technical Notes

*   SVG Icon: `<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>`
*   Tooltips in VS Code Webviews are typically implemented via the `title` attribute for native behavior.
