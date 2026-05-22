import type { ExecResult, GitRunner } from "@/git/core/GitRunner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogEngine } from "@/git/core/LogEngine";

describe("logEngine", () => {
    const mockRunner: GitRunner = {
        exec: vi.fn(),
    };

    const logEngine = new LogEngine(mockRunner);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("getGitLog filters author using name-only regex", async () => {
        vi.mocked(mockRunner.exec).mockResolvedValue({
            stdout: "",
            stderr: "",
            exitCode: 0,
        } as ExecResult);

        await logEngine.getGitLog(null, 0, 10, { author: "John" });

        const args = vi.mocked(mockRunner.exec).mock.calls[0][0];
        expect(args).toContain("--author");
        expect(args).toContain("John.*<");
    });

    it("getGitLog escapes regex characters in author filter", async () => {
        vi.mocked(mockRunner.exec).mockResolvedValue({
            stdout: "",
            stderr: "",
            exitCode: 0,
        } as ExecResult);

        await logEngine.getGitLog(null, 0, 10, { author: "[John]" });

        const args = vi.mocked(mockRunner.exec).mock.calls[0][0];
        expect(args).toContain("\\[John\\].*<");
    });

    it("getGitLog includes case-insensitive flag for author", async () => {
        vi.mocked(mockRunner.exec).mockResolvedValue({
            stdout: "",
            stderr: "",
            exitCode: 0,
        } as ExecResult);

        await logEngine.getGitLog(null, 0, 10, { author: "John" });

        const args = vi.mocked(mockRunner.exec).mock.calls[0][0];
        const authorIdx = args.indexOf("--author");
        expect(args[authorIdx + 2]).toBe("-i");
    });
});
