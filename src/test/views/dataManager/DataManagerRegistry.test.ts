import type { ViewDataManagerFactory } from "@/views/dataManager/ViewDataManagerFactory";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataManagerRegistry } from "@/views/dataManager/DataManagerRegistry";

// Mock vscode
vi.mock("vscode", () => {
    return {
        workspace: {
            onDidChangeWorkspaceFolders: vi.fn(() => ({ dispose: vi.fn() })),
            getWorkspaceFolder: vi.fn(),
            workspaceFolders: [],
        },
        window: {
            activeTextEditor: undefined,
        },
        EventEmitter: vi.fn(() => ({
            event: vi.fn(),
            fire: vi.fn(),
            dispose: vi.fn(),
        })),
    };
});

describe("dataManagerRegistry", () => {
    let factory: ViewDataManagerFactory;
    let registry: DataManagerRegistry;

    beforeEach(() => {
        vi.clearAllMocks();
        factory = {
            create: vi.fn(cwd => ({
                cwd,
                dispose: vi.fn(),
                workflowEngine: {},
                onDidUpdateLoading: { fire: vi.fn() },
                onDidUpdateCommitHighlight: { fire: vi.fn() },
            }) as any),
        } as any;
        registry = new DataManagerRegistry(factory);
    });

    it("should create and cache manager for new path", () => {
        const path = "/test/repo";
        const manager1 = registry.getManagerForPath(path);
        const manager2 = registry.getManagerForPath(path);

        expect(factory.create).toHaveBeenCalledTimes(1);
        expect(manager1).toBe(manager2);
        expect(manager1.cwd).toBe(path);
    });

    it("should dispose and remove manager", () => {
        const path = "/test/repo";
        const manager = registry.getManagerForPath(path);

        registry.disposeManagerForPath(path);

        expect(manager.dispose).toHaveBeenCalled();

        // Next call should create a new one
        registry.getManagerForPath(path);
        expect(factory.create).toHaveBeenCalledTimes(2);
    });

    it("should dispose all managers on registry dispose", () => {
        const manager1 = registry.getManagerForPath("/path1");
        const manager2 = registry.getManagerForPath("/path2");

        registry.dispose();

        expect(manager1.dispose).toHaveBeenCalled();
        expect(manager2.dispose).toHaveBeenCalled();
    });
});
