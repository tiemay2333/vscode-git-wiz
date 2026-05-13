import type { GitCommit } from "../gitParser";
import { describe, expect, it } from "vitest";
import { getCommitSignature, getCurrentBranchHashes } from "../git/commitHighlight";

function makeCommit(hash: string, email?: string, timestamp?: number, message?: string): GitCommit {
    return {
        hash,
        shortHash: hash.substring(0, 7),
        message: message ?? "commit message",
        date: "2024-01-15",
        timestamp: timestamp ?? 1700000,
        authorTimestamp: timestamp ?? 1700000,
        author: "Test User",
        email: email ?? "test@example.com",
        parents: [],
        refs: [],
    };
}

describe("getCommitSignature", () => {
    it("generates signature with \x1F delimiter", () => {
        const c = makeCommit("xxx", "alice@example.com", 100, "Subject");
        expect(getCommitSignature(c)).toBe("alice@example.com\x1F100\x1FSubject");
    });

    it("trims email and subject", () => {
        const c = makeCommit("xxx", "  alice@example.com  ", 100, "  Subject  ");
        expect(getCommitSignature(c)).toBe("alice@example.com\x1F100\x1FSubject");
    });

    it("uses only the first line of message", () => {
        const c = makeCommit("xxx", "alice@example.com", 100, "Line 1\nLine 2");
        expect(getCommitSignature(c)).toBe("alice@example.com\x1F100\x1FLine 1");
    });
});

describe("getCurrentBranchHashes", () => {
    it("returns empty set for empty commits", () => {
        const result = getCurrentBranchHashes([], new Set(), new Set());
        expect(result.size).toBe(0);
    });

    it("matches by exact hash (tier 1)", () => {
        const commits = [makeCommit("aaa"), makeCommit("bbb"), makeCommit("ccc")];
        const branchHashes = new Set(["aaa", "ccc"]);
        const result = getCurrentBranchHashes(commits, branchHashes, new Set());
        expect(result).toEqual(new Set(["aaa", "ccc"]));
    });

    it("matches by signature when hash differs (tier 2 — cherry-pick)", () => {
        const c = makeCommit("xxx", "alice@example.com", 1700000, "Fix the thing");
        const signatures = new Set([getCommitSignature(c)]);
        const result = getCurrentBranchHashes([c], new Set(), signatures);
        expect(result).toEqual(new Set(["xxx"]));
    });

    it("matches even if signature in set used different spacing but shared utility matches", () => {
        const c = makeCommit("xxx", "alice@example.com", 1700000, "Fix the thing  ");
        // Signature in set was trimmed
        const signatures = new Set(["alice@example.com\x1F1700000\x1FFix the thing"]);
        const result = getCurrentBranchHashes([c], new Set(), signatures);
        expect(result).toEqual(new Set(["xxx"]));
    });

    it("prefers tier 1 over tier 2", () => {
        const c = makeCommit("aaa", "alice@example.com", 1700000, "Fix the thing");
        const branchHashes = new Set(["aaa"]);
        // Also add a signature that matches a different hash, to prove tier 1 dominates
        const signatures = new Set(["bob@example.com\x1F1800000\x1FOther msg"]);
        const result = getCurrentBranchHashes([c], branchHashes, signatures);
        expect(result).toEqual(new Set(["aaa"]));
    });

    it("does not match when neither hash nor signature matches", () => {
        const commits = [makeCommit("zzz", "alice@example.com", 1700000, "Unique")];
        const result = getCurrentBranchHashes(commits, new Set(["other"]), new Set(["other\x1Fsig"]));
        expect(result.size).toBe(0);
    });

    it("matches multiple commits with mixed tier 1 and tier 2", () => {
        const commits = [
            makeCommit("hash1", "alice@example.com", 100, "Alpha"),
            makeCommit("hash2", "bob@example.com", 200, "Beta"),
            makeCommit("hash3", "carol@example.com", 300, "Gamma"),
        ];
        const branchHashes = new Set(["hash1"]);
        const signatures = new Set([getCommitSignature(commits[2])]);
        const result = getCurrentBranchHashes(commits, branchHashes, signatures);
        expect(result).toEqual(new Set(["hash1", "hash3"]));
    });

    it("handles commits with missing optional fields gracefully", () => {
        const c: GitCommit = {
            hash: "bad",
            shortHash: "bad",
            message: "",
            date: "",
            timestamp: 0,
            authorTimestamp: 0,
            author: "",
            email: "",
            parents: [],
            refs: [],
        };
        // Should not throw for any missing field
        expect(() => getCurrentBranchHashes([c], new Set(), new Set())).not.toThrow();
    });
});
