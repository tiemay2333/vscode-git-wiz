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
        gitService = { cwd: "/test/repo" };
        workflowEngine = {};
        verifier = { reset: vi.fn(), dispose: vi.fn() };
        manager = new ViewDataManager("/test/repo", gitService, workflowEngine, verifier);
    });

    it("should debounce refresh calls and merge resetScroll flag", () => {
        const fireSpy = (manager as any)._onDidRefresh.fire;

        manager.refreshAll({ resetScroll: false });
        manager.refreshAll({ resetScroll: true });
        manager.refreshAll({ resetScroll: false });

        expect(fireSpy).not.toHaveBeenCalled();

        vi.runAllTimers();

        expect(fireSpy).toHaveBeenCalledTimes(1);
        expect(fireSpy).toHaveBeenCalledWith({ resetScroll: true });
    });

    it("should handle lock state and pending refresh", async () => {
        const fireSpy = (manager as any)._onDidRefresh.fire;

        // Simulate lock
        (manager as any)._isLocked = true;

        manager.refreshAll({ resetScroll: true });

        vi.runAllTimers();
        expect(fireSpy).not.toHaveBeenCalled();
        expect((manager as any)._pendingRefresh).toBe(true);
        expect((manager as any)._pendingResetScroll).toBe(true);

        // Simulate unlock and trigger pending
        (manager as any)._isLocked = false;
        (manager as any).refreshAll(); // Trigger the pending one

        vi.runAllTimers();
        expect(fireSpy).toHaveBeenCalledWith({ resetScroll: true });
    });
});
