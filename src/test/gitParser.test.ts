import { describe, expect, it } from "vitest";
import { parseGitLogOutput } from "../gitParser";

describe("parseGitLogOutput", () => {
    it("returns empty array for empty input", () => {
        expect(parseGitLogOutput("")).toEqual([]);
        expect(parseGitLogOutput("\n\n")).toEqual([]);
    });

    it("parses a single commit with no refs", () => {
        const line = "abc123def456\x1Fabc123\x1Fparent111\x1FJane Doe\x1Fjane@doe.com\x1F2024-01-15 10:30:00 +0000\x1F\x1F1700000\x1F1700000\x1FFix bug in parser";
        const [commit] = parseGitLogOutput(line);

        expect(commit.hash).toBe("abc123def456");
        expect(commit.shortHash).toBe("abc123");
        expect(commit.message).toBe("Fix bug in parser");
        expect(commit.author).toBe("Jane Doe");
        expect(commit.parents).toEqual(["parent111"]);
        expect(commit.refs).toEqual([]);
        expect(commit.authorTimestamp).toBe(1700000);
    });

    it("parses a commit with HEAD and branch refs", () => {
        const line = "abc123\x1Fabc\x1Fparent1\x1FAlice\x1Falice@example.com\x1F2024-01-15 10:00:00 +0000\x1FHEAD -> main, origin/main\x1F171000\x1F171000\x1FInitial commit";
        const [commit] = parseGitLogOutput(line);

        expect(commit.refs).toEqual(["HEAD -> main", "origin/main"]);
    });

    it("parses a merge commit with multiple parents", () => {
        const line = "merge111\x1Fmer111\x1Fparent1 parent2\x1FBob\x1Fbob@example.com\x1F2024-01-15 12:00:00 +0000\x1F\x1F171000\x1F171000\x1FMerge feature into main";
        const [commit] = parseGitLogOutput(line);

        expect(commit.parents).toEqual(["parent1", "parent2"]);
    });

    it("parses a commit message containing pipe characters", () => {
        const line = "abc123\x1Fabc\x1Fparent1\x1FCarol\x1Fcarol@example.com\x1F2024-01-15 09:00:00 +0000\x1F\x1F171000\x1F171000\x1Ffeat: add a|b|c support";
        const [commit] = parseGitLogOutput(line);

        expect(commit.message).toBe("feat: add a|b|c support");
    });

    it("parses multiple commits", () => {
        const input = [
            "hash1\x1Fsh1\x1Fpar1\x1FAlice\x1Falice@example.com\x1F2024-01-15 10:00:00 +0000\x1FHEAD -> main\x1F171000\x1F171000\x1FFirst commit",
            "hash2\x1Fsh2\x1Fpar2\x1FBob\x1Fbob@example.com\x1F2024-01-14 09:00:00 +0000\x1F\x1F171000\x1F171000\x1FSecond commit",
        ].join("\n");

        const commits = parseGitLogOutput(input);
        expect(commits).toHaveLength(2);
        expect(commits[0].hash).toBe("hash1");
        expect(commits[1].hash).toBe("hash2");
    });

    it("parses a root commit with no parent", () => {
        const line = "root111\x1Froot11\x1F\x1FAlice\x1Falice@example.com\x1F2024-01-01 00:00:00 +0000\x1F\x1F171000\x1F171000\x1FInitial commit";
        const [commit] = parseGitLogOutput(line);

        expect(commit.parents).toEqual([]);
    });

    it("trims whitespace from hash, author, and message", () => {
        const line = " abc123 \x1F abc \x1F par1 \x1F Alice Smith \x1F alice@smith.com \x1F 2024-01-15 10:00:00 +0000 \x1F \x1F 171000 \x1F 171000 \x1F Fix thing ";
        const [commit] = parseGitLogOutput(line);

        expect(commit.hash).toBe("abc123");
        expect(commit.author).toBe("Alice Smith");
        expect(commit.message).toBe("Fix thing");
    });

    it("parses tag refs correctly", () => {
        const line = "abc123\x1Fabc\x1Fpar1\x1FAlice\x1Falice@example.com\x1F2024-01-15 10:00:00 +0000\x1Ftag: v1.0.0, HEAD -> main\x1F171000\x1F171000\x1FRelease";
        const [commit] = parseGitLogOutput(line);

        expect(commit.refs).toEqual(["tag: v1.0.0", "HEAD -> main"]);
    });
});
