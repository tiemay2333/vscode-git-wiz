import { beforeEach, describe, expect, it, vi } from "vitest";
import { ViewDataManager } from "@/views/ViewDataManager";

// Mock vscode
vi.mock("vscode", () => {
    class MockEventEmitter {
        event = vi.fn();
        fire = vi.fn();
        dispose = vi.fn();
    }
    return {
        workspace: {
            onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
            createFileSystemWatcher: vi.fn(() => ({
                onDidChange: vi.fn(),
                onDidCreate: vi.fn(),
                onDidDelete: vi.fn(),
                dispose: vi.fn(),
            })),
            getWorkspaceFolder: vi.fn(() => ({ uri: { fsPath: "/test/repo" } })),
            fs: {
                stat: vi.fn().mockRejectedValue(new Error("File not found")),
            },
            getConfiguration: vi.fn(() => ({
                get: vi.fn((key) => {
                    if (key === "highlightCurrentBranch")
                        return false;
                    return undefined;
                }),
            })),
        },
        Uri: {
            file: vi.fn(path => ({ fsPath: path, with: vi.fn().mockReturnThis() })),
        },
        RelativePattern: vi.fn(),
        EventEmitter: MockEventEmitter,
    };
});

describe("viewDataManager", () => {
    let gitService: any;
    let workflowEngine: any;
    let verifier: any;
    let manager: ViewDataManager;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        gitService = {
            history: {
                getGitLog: vi.fn().mockResolvedValue([]),
                getBranchCommits: vi.fn().mockResolvedValue(new Set()),
            },
            refs: {
                getCurrentBranch: vi.fn().mockResolvedValue("main"),
                getBranches: vi.fn().mockResolvedValue([]),
                getHeadHash: vi.fn().mockResolvedValue("hash"),
            },
        };
        workflowEngine = {};
        verifier = { reset: vi.fn(), dispose: vi.fn() };
        manager = new ViewDataManager("/test/repo", gitService, workflowEngine, verifier);
    });

    it("should debounce refresh calls and merge resetScroll flag", async () => {
        const fireSpy = (manager as any)._onDidUpdateSnapshot.fire;
        manager.setReady(true);

        manager.refreshAll({ resetScroll: false });
        manager.refreshAll({ resetScroll: true });
        manager.refreshAll({ resetScroll: false });

        expect(fireSpy).not.toHaveBeenCalled();

        vi.runAllTimers();
        // Wait for async _doRefresh
        await vi.runAllTimersAsync();

        expect(fireSpy).toHaveBeenCalled();
        const lastCall = fireSpy.mock.calls[fireSpy.mock.calls.length - 1][0];
        expect(lastCall.resetScroll).toBe(true);
    });

    it("should handle lock state and pending refresh", async () => {
        const fireSpy = (manager as any)._onDidUpdateSnapshot.fire;
        manager.setReady(true);

        // Simulate lock
        (manager as any)._isLocked = true;

        manager.refreshAll({ resetScroll: true });

        vi.runAllTimers();
        await vi.runAllTimersAsync();
        expect(fireSpy).not.toHaveBeenCalled();
        expect((manager as any)._pendingRefresh).toBe(true);
        expect((manager as any)._pendingResetScroll).toBe(true);

        // Simulate unlock and trigger pending
        (manager as any)._isLocked = false;
        (manager as any).refreshAll(); // Trigger the pending one

        vi.runAllTimers();
        await vi.runAllTimersAsync();
        const lastCall = fireSpy.mock.calls[fireSpy.mock.calls.length - 1][0];
        expect(lastCall.resetScroll).toBe(true);
    });
});
