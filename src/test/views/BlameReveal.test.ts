import { describe, expect, it, vi } from "vitest";
import { GitGraphViewProvider } from "@/views/GitGraphViewProvider";

vi.mock("vscode", () => ({
    commands: { executeCommand: vi.fn().mockResolvedValue(undefined) },
    workspace: { getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }) },
    env: { language: "en" },
}));
vi.mock("@/views/MessageDispatcher", () => ({
    MessageDispatcher: class { register() {} async dispatch() {} dispose() {} },
}));
vi.mock("@/views/handlers", () => {
    class Handler { commands = []; dispose() {} }
    return { CoreHandler: Handler, FileHandler: Handler, GitCommandHandler: Handler, SettingsHandler: Handler, UIStateHandler: Handler };
});
vi.mock("@/views/webviewContent", () => ({ getHtmlForWebview: () => "<html></html>" }));

describe("blame to graph navigation", () => {
    it("waits for the visible target snapshot, then reveals after replacing the graph", async () => {
        let snapshotListener!: (snapshot: any) => void;
        const disposable = { dispose: vi.fn() };
        const manager = {
            onDidUpdateSnapshot: (listener: typeof snapshotListener) => {
                snapshotListener = listener;
                return disposable;
            },
            onDidUpdateCommitHighlight: () => disposable,
            onDidUpdateLoading: () => disposable,
            setFilterBranch: vi.fn(),
            setFilterFile: vi.fn(),
            setSearchFilters: vi.fn(),
            setReady: vi.fn(),
            refreshAll: vi.fn(),
            getSnapshot: () => undefined,
            refs: { getCurrentBranch: async () => "main", getBranches: async () => [] },
        };
        const otherManager = { ...manager, setReady: vi.fn() };
        const provider = new GitGraphViewProvider({} as any, "/repo", { getManagerForPath: (cwd: string) => cwd === "/repo" ? manager : otherManager } as any);
        const view = { visible: false, webview: { postMessage: vi.fn(), onDidReceiveMessage: vi.fn() }, onDidChangeVisibility: vi.fn(), onDidDispose: vi.fn() };
        provider.resolveWebviewView(view as any, {} as any, {} as any);
        await provider.revealCommit("/repo", "a".repeat(40));
        expect(manager.setFilterBranch).toHaveBeenCalledWith("a".repeat(40));
        expect(manager.setFilterFile).toHaveBeenCalledWith(null);
        expect(manager.setSearchFilters).toHaveBeenCalledWith(undefined);
        const snapshot = { commits: [{ hash: "a".repeat(40) }], branches: [], uiStatus: {}, filterBranch: "a".repeat(40) };
        snapshotListener(snapshot);
        expect(view.webview.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ command: "revealCommit" }));
        view.visible = true;
        snapshotListener({ ...snapshot, filterBranch: "other" });
        expect(view.webview.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ command: "revealCommit" }));
        snapshotListener(snapshot);
        const messages = view.webview.postMessage.mock.calls.map(([message]) => message.command);
        expect(messages.slice(-3)).toEqual(["replaceCommits", "replaceBranches", "revealCommit"]);
        expect(view.webview.postMessage).toHaveBeenLastCalledWith({ command: "revealCommit", hash: "a".repeat(40) });
        const readyListener = view.webview.onDidReceiveMessage.mock.calls[0][0];
        await readyListener({ command: "ready" });
        provider.updateCwd("/other");
        expect(otherManager.setReady).toHaveBeenCalledWith(true);
        provider.dispose();
    });
});
