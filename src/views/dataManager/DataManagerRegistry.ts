import type { IViewDataManager } from "./IViewDataManager";
import type { ViewDataManagerFactory } from "./ViewDataManagerFactory";
import * as vscode from "vscode";

/**
 * 负责统一管理 ViewDataManager 实例的生命周期
 */
export class DataManagerRegistry implements vscode.Disposable {
    private readonly _instances = new Map<string, IViewDataManager>();
    private readonly _disposables: vscode.Disposable[] = [];

    constructor(private readonly _factory: ViewDataManagerFactory) {
        this._disposables.push(vscode.workspace.onDidChangeWorkspaceFolders((e) => {
            for (const folder of e.removed) {
                this.disposeManagerForPath(folder.uri.fsPath);
            }
        }));
    }

    public getManagerForPath(cwd: string): IViewDataManager {
        let manager = this._instances.get(cwd);
        if (!manager) {
            manager = this._factory.create(
                cwd,
                visible => (manager as any)._onDidUpdateLoading.fire(visible),
                (hash, status) => (manager as any)._onDidUpdateCommitHighlight.fire({ hash, verificationStatus: status }),
            );
            // 修正 workflowEngine 的刷新回调
            (manager.workflowEngine as any)._refreshCallback = () => manager!.refreshAll();

            this._instances.set(cwd, manager);
        }
        return manager;
    }

    public disposeManagerForPath(cwd: string) {
        const manager = this._instances.get(cwd);
        if (manager) {
            manager.dispose();
            this._instances.delete(cwd);
        }
    }

    public getActiveManager(): IViewDataManager | undefined {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
            if (workspaceFolder) {
                return this.getManagerForPath(workspaceFolder.uri.fsPath);
            }
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return this.getManagerForPath(workspaceFolders[0].uri.fsPath);
        }

        return undefined;
    }

    public dispose() {
        this._disposables.forEach(d => d.dispose());
        for (const manager of this._instances.values()) {
            manager.dispose();
        }
        this._instances.clear();
    }
}
