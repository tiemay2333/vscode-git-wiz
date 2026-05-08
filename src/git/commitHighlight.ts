import type { GitCommit } from "../gitParser";

/**
 * Pure function: returns hashes of commits belonging to the current branch.
 *
 * Two-tier matching:
 *   Tier 1 — exact hash match against `git rev-list <branch>` output
 *   Tier 2 — signature match (cherry-pick detection via email + timestamp + subject)
 */
export function getCurrentBranchHashes(
    commits: GitCommit[],
    branchHashes: Set<string>,
    branchSignatures: Set<string>,
): Set<string> {
    const result = new Set<string>();
    const remaining: GitCommit[] = [];

    // Tier 1: hash match (fast, exact)
    for (const c of commits) {
        if (branchHashes.has(c.hash)) {
            result.add(c.hash);
        }
        else {
            remaining.push(c);
        }
    }

    if (remaining.length === 0) {
        return result;
    }

    // Tier 2: signature match (cherry-picks)
    // Cherry-pick preserves author email, author timestamp, and subject line.
    for (const c of remaining) {
        const sig = `${c.email}|${c.authorTimestamp}|${c.message.split("\n")[0]}`;
        if (branchSignatures.has(sig)) {
            result.add(c.hash);
        }
    }

    return result;
}
