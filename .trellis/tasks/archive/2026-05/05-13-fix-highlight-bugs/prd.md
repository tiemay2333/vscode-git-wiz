# brainstorm: Fix branch highlighting logic bugs

## Goal

Fix identified bugs in the current branch highlighting logic to ensure consistent and robust identification of commits belonging to the current branch, including cherry-picks.

## Requirements

1.  **Robust Delimiter**: Switch from `|` to `\x1f` (Unit Separator) in `git log --format` to prevent conflicts with author names or subjects.
2.  **Shared Signature Logic**: Extract signature generation to a shared utility `getCommitSignature(commit: GitCommit): string` to ensure consistent `trim()` and formatting.
3.  **Smart Cache Invalidation**: In `GitGraphViewProvider`, validate the signature cache by checking the Head Hash of the current branch before reuse.
4.  **Robust Parsing**: Update `parseGitLogOutput` to handle the new delimiter and ensure all metadata is correctly trimmed.

## Acceptance Criteria

*   [ ] Commits with `|` in author names or subjects are parsed correctly.
*   [ ] Cherry-picks are correctly highlighted even if subjects have trailing spaces.
*   [ ] Cherry-picks performed in the same session are highlighted after a refresh or loading more commits (via Head Hash validation).
*   [ ] Unit tests in `commitHighlight.test.ts` pass and include cases for the above.

## Technical Approach

*   Modify `src/gitOperations.ts` to use `\x1f` and implement Head Hash retrieval.
*   Modify `src/gitParser.ts` to split by `\x1f`.
*   Modify `src/git/commitHighlight.ts` to add and use `getCommitSignature`.
*   Modify `src/gitGraphView.ts` to implement cache validation.

## Definition of Done

*   Tests added/updated (unit/integration where appropriate)
*   Lint / typecheck / CI green
*   Docs/notes updated if behavior changes

## Technical Notes

*   Impacted files: `src/git/commitHighlight.ts`, `src/gitOperations.ts`, `src/gitGraphView.ts`, `src/gitParser.ts`, `src/test/commitHighlight.test.ts`.
