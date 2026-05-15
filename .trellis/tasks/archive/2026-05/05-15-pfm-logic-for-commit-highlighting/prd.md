# PFM logic for commit highlighting

## Goal

Enhance the commit highlighting mechanism to detect partial matches (Partial File Matching) when a full `patch-id` match fails. This improves the accuracy of identifying cherry-picked or manually ported changes that may have slight modifications (e.g., in commit message context or unrelated files in the same commit).

## What I already know

* Current logic uses `rev-list` for exact hash matches (Tier 1).
* Uses `signature` (email + subject) for candidates (Tier 2).
* Uses `patch-id` for verification (Tier 3).
* User wants to add PFM when `patch-id` fails.
* PFM should start with path filtering: all files in the source commit must have corresponding paths/names in the target candidate commit.
* If paths match, individual file content hashes (file-level patch-ids) are calculated and compared.
* No UI distinction is required for partial matches; they should be treated as "verified".

## Assumptions (temporary)

* "Partial File Matching (PFM)" follows the logic $Target \subseteq Source$ (where Source is the commit in the graph, and Target is the candidate on the current branch).
* Specifically: All file paths in the **current branch's commit (Target)** must exist in the **comparison branch's commit (Source)**, and their content hashes must match.
* Performance is a priority, so we should avoid calling `git show` multiple times per file.

## Open Questions

* None. (Confirmed $T \subseteq S$ with user).

## Requirements (evolving)

* Update `AsyncHighlightVerifier` to implement the tiered logic.
* Implement a way to extract per-file diffs and calculate stable hashes in `GitService`.
* Optimization: Parse `git show` output in JS to calculate multiple file hashes in one go.

## Acceptance Criteria (evolving)

* [ ] Full `patch-id` match still works.
* [ ] If `patch-id` fails, but all source files are present in a target commit and their content diffs match, the source commit is marked as `verified`.
* [ ] Performance remains acceptable for commits with multiple files.

## Definition of Done (team quality bar)

* Tests added/updated (unit tests for PFM logic)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes

## Out of Scope (explicit)

* UI changes for partial matches (per user request).
* Matching where file contents are partially equivalent (e.g., fuzzy matching).

## Technical Notes

* `src/git/AsyncHighlightVerifier.ts` is the main entry point for background verification.
* `src/gitOperations.ts` needs a method to get file-level patch-ids or parsed diffs.
