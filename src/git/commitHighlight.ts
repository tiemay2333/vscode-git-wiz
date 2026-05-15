import type { GitCommit } from "../gitParser";

/**
 * Shared signature generation for cherry-pick detection.
 * Cherry-pick preserves author email and subject line.
 */
export function createSignature(email: string, subject: string): string {
    return `${email.trim()}\x1F${subject.trim()}`;
}

export function getCommitSignature(c: GitCommit): string {
    const subject = c.message.split("\n")[0];
    return createSignature(c.email, subject);
}

export interface HighlightResult {
    verified: Set<string>;
    pending: Map<string, string[]>; // commit hash -> potential match hashes on current branch
}

/**
 * Pure function: returns hashes of commits belonging to the current branch.
 *
 * Tiered matching:
 *   Tier 1 — exact hash match against `git rev-list <branch>` output
 *   Tier 2 — signature match (cherry-pick candidate via email + timestamp + subject)
 */
export function getCurrentBranchHashes(
    commits: GitCommit[],
    branchHashes: Set<string>,
    branchSignatures: Map<string, string[]>,
): HighlightResult {
    const verified = new Set<string>();
    const pending = new Map<string, string[]>();
    const remaining: GitCommit[] = [];

    // Tier 1: hash match (fast, exact)
    for (const c of commits) {
        if (branchHashes.has(c.hash)) {
            verified.add(c.hash);
        }
        else {
            remaining.push(c);
        }
    }

    if (remaining.length === 0) {
        return { verified, pending };
    }

    // Tier 2: signature match (cherry-pick candidates)
    for (const c of remaining) {
        // Skip merge commits and system-generated records for signature matching
        if (c.parents.length > 1 || c.message.toLowerCase().startsWith("merge ")) {
            continue;
        }

        const sig = getCommitSignature(c);
        const matches = branchSignatures.get(sig);
        if (matches) {
            pending.set(c.hash, matches);
        }
    }

    return { verified, pending };
}
