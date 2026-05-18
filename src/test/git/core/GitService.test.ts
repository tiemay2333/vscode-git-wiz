import type { ExecResult, GitRunner } from "@/git/core/GitRunner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitService } from "@/git/core/GitService";

describe("gitService", () => {
    const mockRunner: GitRunner = {
        exec: vi.fn(),
    };

    const service = new GitService({
        cwd: "/fake/path",
        runner: mockRunner,
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("getBranches returns correctly parsed branches", async () => {
        vi.mocked(mockRunner.exec).mockResolvedValueOnce({
            stdout: "refs/heads/main\x1Fmain\x1F*\nrefs/remotes/origin/main\x1Forigin/main\x1F ",
            stderr: "",
            exitCode: 0,
        } as ExecResult);

        const branches = await service.getBranches();
        expect(branches).toHaveLength(2);
        expect(branches[0]).toEqual({
            name: "main",
            fullName: "main",
            isRemote: false,
            isHead: true,
            isTag: false,
        });
        expect(branches[1]).toEqual({
            name: "main", // parsing logic trims the remote part for name
            fullName: "origin/main",
            isRemote: true,
            isHead: false,
            isTag: false,
        });
    });

    it("getCurrentBranch returns branch name from stdout", async () => {
        vi.mocked(mockRunner.exec).mockResolvedValueOnce({
            stdout: "feature/test",
            stderr: "",
            exitCode: 0,
        } as ExecResult);

        const branch = await service.getCurrentBranch();
        expect(branch).toBe("feature/test");
        expect(mockRunner.exec).toHaveBeenCalledWith(["rev-parse", "--abbrev-ref", "HEAD"]);
    });

    it("getHeadHash calls git rev-parse with branch name", async () => {
        vi.mocked(mockRunner.exec).mockResolvedValueOnce({
            stdout: "a1b2c3d",
            stderr: "",
            exitCode: 0,
        } as ExecResult);

        const hash = await service.getHeadHash("main");
        expect(hash).toBe("a1b2c3d");
        expect(mockRunner.exec).toHaveBeenCalledWith(["rev-parse", "main"]);
    });

    it("getUnfilteredLog calls git log with correct arguments", async () => {
        vi.mocked(mockRunner.exec).mockResolvedValueOnce({
            stdout: "hash1\x1Fh1\x1Fparent1\x1Fauthor\x1Femail\x1F2023-01-01\x1Frefs\x1F1672531200\x1F1672531200\x1Fmsg",
            stderr: "",
            exitCode: 0,
        } as ExecResult);

        await service.getUnfilteredLog("main", 10, 50);
        expect(mockRunner.exec).toHaveBeenCalledWith(
            expect.arrayContaining(["log", "main", "--skip=10", "--max-count=50"]),
            expect.any(Object),
        );
    });

    it("cherryPickCommit calls git cherry-pick", async () => {
        vi.mocked(mockRunner.exec).mockResolvedValueOnce({
            stdout: "",
            stderr: "",
            exitCode: 0,
        } as ExecResult);

        await service.cherryPickCommit("hash123");
        expect(mockRunner.exec).toHaveBeenCalledWith(["cherry-pick", "hash123"]);
    });

    it("revertCommit calls git revert with --no-edit", async () => {
        vi.mocked(mockRunner.exec).mockResolvedValueOnce({
            stdout: "",
            stderr: "",
            exitCode: 0,
        } as ExecResult);

        await service.revertCommit("hash123");
        expect(mockRunner.exec).toHaveBeenCalledWith(["revert", "hash123", "--no-edit"]);
    });

    it("getCommitFilePatchIds parses git show output and returns per-file patch-ids", async () => {
        const showOutput = `diff --git a/file1.ts b/file1.ts
index 123..456 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1 +1 @@
-old
+new
diff --git a/dir/file2.js b/dir/file2.js
index 789..abc 100644
--- a/dir/file2.js
+++ b/dir/file2.js
@@ -1 +1 @@
-foo
+bar
`;
        vi.mocked(mockRunner.exec).mockResolvedValueOnce({
            stdout: showOutput,
            stderr: "",
            exitCode: 0,
        } as ExecResult);

        // Mock two patch-id calls
        vi.mocked(mockRunner.exec)
            .mockResolvedValueOnce({ stdout: "pid1 hash1", stderr: "", exitCode: 0 } as ExecResult)
            .mockResolvedValueOnce({ stdout: "pid2 hash2", stderr: "", exitCode: 0 } as ExecResult);

        const result = await service.getCommitFilePatchIds("some-hash");
        expect(result.size).toBe(2);
        expect(result.get("file1.ts")).toBe("pid1");
        expect(result.get("dir/file2.js")).toBe("pid2");

        expect(mockRunner.exec).toHaveBeenCalledWith(["show", "--pretty=format:", "some-hash"]);
        expect(mockRunner.exec).toHaveBeenCalledWith(["patch-id", "--stable"], { stdin: "diff --git a/file1.ts b/file1.ts\nindex 123..456 100644\n--- a/file1.ts\n+++ b/file1.ts\n@@ -1 +1 @@\n-old\n+new\n" });
    });
});
