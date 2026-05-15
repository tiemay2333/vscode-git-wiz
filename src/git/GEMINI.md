# Git Module Instructions

## Highlighting Tiers

The commit highlighting system (cherry-pick detection) uses a 4-tier verification process:

1.  **Tier 1 (Exact Hash)**: `rev-list` match. Instant.
2.  **Tier 2 (Signature)**: Author Email + Subject line match. Instant.
3.  **Tier 3 (Full Patch-ID)**: `git patch-id` on the entire commit. Verified in background.
4.  **Tier 4 (Partial File Matching - PFM)**: When Tier 3 fails, checks if $T_{files} \subseteq S_{files}$ (Target is a subset of Source). If every file in the current branch's commit (Target) exists in the comparison branch's commit (Source) with matching content hashes, the commit is verified.

## Performance Notes

*   `AsyncHighlightVerifier` manages background verification with a concurrency limit (default 3).
*   File-level patch-ids are cached in memory to avoid redundant `git show` calls.
*   `GitService.getCommitFilePatchIds` parses a single `git show` output to extract all file diffs.
