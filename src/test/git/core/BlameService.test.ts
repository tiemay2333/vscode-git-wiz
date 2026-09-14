import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BlameService } from "@/git/core/BlameService";
import { ChildProcessGitRunner } from "@/git/core/GitRunner";

describe("blameService with real Git", () => {
    let cwd: string;
    let service: BlameService;
    const git = (...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    beforeEach(() => {
        cwd = mkdtempSync(path.join(tmpdir(), "git-wiz-blame-"));
        git("init", "-q");
        git("config", "user.name", "Test Author");
        git("config", "user.email", "author@example.com");
        service = new BlameService(new ChildProcessGitRunner());
    });
    afterEach(() => rmSync(cwd, { recursive: true, force: true }));

    it("attributes repeated lines and unsaved changes in a nested file with spaces", async () => {
        mkdirSync(path.join(cwd, "nested"));
        const file = path.join(cwd, "nested", "测试 file.txt");
        writeFileSync(file, "first\nsecond\nthird\n");
        git("add", ".");
        git("commit", "-qm", "Original | message", "-m", "Full commit body\nSecond body line");
        const hash = git("rev-parse", "HEAD");
        const result = await service.getBlame(file, "first\nmodified\nthird\n");
        expect(result?.lines.map(line => [line.line, line.hash])).toEqual([
            [0, hash],
            [1, "0".repeat(40)],
            [2, hash],
        ]);
        expect(result?.lines[2]).toMatchObject({
            author: "Test Author",
            email: "author@example.com",
            summary: "Original | message",
            message: "Original | message\n\nFull commit body\nSecond body line",
            commitTime: new Date(Number(git("show", "-s", "--format=%ct", "HEAD")) * 1000).toISOString(),
        });
        expect(result?.cwd).toBe(git("rev-parse", "--show-toplevel"));
    });

    it("handles an empty unsaved buffer without waiting forever on stdin", async () => {
        const file = path.join(cwd, "file.txt");
        writeFileSync(file, "old\n");
        git("add", ".");
        git("commit", "-qm", "Initial");
        expect((await service.getBlame(file, ""))?.lines).toEqual([]);
    });

    it("keeps attribution for trailing blank lines", async () => {
        const file = path.join(cwd, "file.txt");
        writeFileSync(file, "line\n\n");
        git("add", ".");
        git("commit", "-qm", "Blank line");
        expect((await service.getBlame(file, "line\n\n"))?.lines.map(line => line.line)).toEqual([0, 1]);
    });

    it("marks untracked files and staged files in unborn repositories as uncommitted", async () => {
        const file = path.join(cwd, "new.txt");
        writeFileSync(file, "new\n");
        expect((await service.getBlame(file, "new\n"))?.lines[0].hash).toBe("0".repeat(40));
        git("add", ".");
        expect((await service.getBlame(file, "new\n"))?.lines[0].hash).toBe("0".repeat(40));
    });

    it("works in linked worktrees", async () => {
        writeFileSync(path.join(cwd, "file.txt"), "line\n");
        git("add", ".");
        git("commit", "-qm", "Initial");
        const worktree = path.join(cwd, "linked");
        git("worktree", "add", "-q", "-b", "linked", worktree);
        const result = await service.getBlame(path.join(worktree, "file.txt"), "line\n");
        expect(result?.cwd).toBe(execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: worktree, encoding: "utf8" }).trim());
        expect(result?.lines[0].hash).toBe(git("rev-parse", "HEAD"));
    });
});
