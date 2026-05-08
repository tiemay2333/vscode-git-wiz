import { describe, expect, it } from "vitest";
import { ChildProcessGitRunner } from "../git/GitRunner";

describe("childProcessGitRunner", () => {
    const runner = new ChildProcessGitRunner();

    it("executes a git command and returns stdout", async () => {
        const result = await runner.exec(["--version"]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/^git version/);
    });

    it("returns non-zero exit code on failure", async () => {
        const result = await runner.exec(["this-is-not-a-git-command"]);
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toBeTruthy();
    });

    it("returns stderr on error", async () => {
        const result = await runner.exec(["log", "--no-such-flag"]);
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toBeTruthy();
    });

    it("always resolves (never rejects)", async () => {
        // Should not throw for any input
        await expect(runner.exec(["this-should-fail"])).resolves.toBeDefined();
    });

    it("uses provided cwd for execution", async () => {
        const result = await runner.exec(["rev-parse", "--git-dir"], {
            cwd: process.cwd(),
        });
        // We're in a git repo, so git dir should be found
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(".git");
    });

    it("returns success exit code 0 for valid command", async () => {
        const result = await runner.exec(["status", "--porcelain"]);
        expect(result.exitCode).toBe(0);
    });
});
