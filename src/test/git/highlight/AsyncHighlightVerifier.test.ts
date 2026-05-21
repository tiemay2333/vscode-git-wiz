import type { GitService } from "@/git/core/GitService";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AsyncHighlightVerifier } from "@/git/highlight/AsyncHighlightVerifier";

describe("asyncHighlightVerifier", () => {
    let mockGitService: any;
    let onUpdate: any;
    let verifier: AsyncHighlightVerifier;

    beforeEach(() => {
        mockGitService = {
            history: {
                getPatchId: vi.fn(),
                getCommitFilePatchIds: vi.fn(),
            },
        };
        onUpdate = vi.fn();
        verifier = new AsyncHighlightVerifier(mockGitService as any as GitService, onUpdate);
    });

    it("verifies when full patch-id matches", async () => {
        mockGitService.history.getPatchId.mockImplementation(async (hash: string) => {
            if (hash === "source" || hash === "target")
                return "pid-match";
            return "pid-other";
        });

        verifier.queueVerification("source", ["target"]);

        // Wait for async process
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(onUpdate).toHaveBeenCalledWith("source", "verified");
    });

    it("fails when patch-id differs and paths differ", async () => {
        mockGitService.history.getPatchId.mockImplementation(async (hash: string) => {
            return hash === "source" ? "pid1" : "pid2";
        });
        mockGitService.history.getCommitFilePatchIds.mockImplementation(async (hash: string) => {
            if (hash === "source")
                return new Map([["fileA", "contentA"]]);
            if (hash === "target")
                return new Map([["fileB", "contentB"]]);
            return new Map();
        });

        verifier.queueVerification("source", ["target"]);
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(onUpdate).toHaveBeenCalledWith("source", "failed");
    });

    it("verifies when patch-id differs but all files match (PFM)", async () => {
        mockGitService.history.getPatchId.mockImplementation(async (hash: string) => {
            return hash === "source" ? "pid1" : "pid2";
        });
        mockGitService.history.getCommitFilePatchIds.mockImplementation(async () => {
            // Both source and target have same files with same content hashes
            return new Map([["fileA", "contentA"], ["fileB", "contentB"]]);
        });

        verifier.queueVerification("source", ["target"]);
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(onUpdate).toHaveBeenCalledWith("source", "verified");
    });

    it("fails when paths match but one file content differs", async () => {
        mockGitService.history.getPatchId.mockImplementation(async (hash: string) => {
            return hash === "source" ? "pid1" : "pid2";
        });
        mockGitService.history.getCommitFilePatchIds.mockImplementation(async (hash: string) => {
            if (hash === "source")
                return new Map([["fileA", "contentA"]]);
            if (hash === "target")
                return new Map([["fileA", "contentA-modified"]]);
            return new Map();
        });

        verifier.queueVerification("source", ["target"]);
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(onUpdate).toHaveBeenCalledWith("source", "failed");
    });

    it("verifies when target is a subset of source (T ⊆ S)", async () => {
        mockGitService.history.getPatchId.mockImplementation(async (hash: string) => {
            return hash === "source" ? "pid1" : "pid2";
        });
        mockGitService.history.getCommitFilePatchIds.mockImplementation(async (hash: string) => {
            // Target {fileA} is a subset of Source {fileA, fileB}
            if (hash === "source")
                return new Map([["fileA", "contentA"], ["fileB", "contentB"]]);
            if (hash === "target")
                return new Map([["fileA", "contentA"]]);
            return new Map();
        });

        verifier.queueVerification("source", ["target"]);
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(onUpdate).toHaveBeenCalledWith("source", "verified");
    });

    it("fails when target has files not in source (S ⊂ T)", async () => {
        mockGitService.history.getPatchId.mockImplementation(async (hash: string) => {
            return hash === "source" ? "pid1" : "pid2";
        });
        mockGitService.history.getCommitFilePatchIds.mockImplementation(async (hash: string) => {
            if (hash === "source")
                return new Map([["fileA", "contentA"]]);
            if (hash === "target")
                return new Map([["fileA", "contentA"], ["fileExtra", "contentE"]]);
            return new Map();
        });

        verifier.queueVerification("source", ["target"]);
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(onUpdate).toHaveBeenCalledWith("source", "failed");
    });
});
