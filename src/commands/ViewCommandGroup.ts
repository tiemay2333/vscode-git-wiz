import type { ICommandGroup } from "./ICommandGroup";
import type { DataManagerRegistry } from "@/views/dataManager/DataManagerRegistry";
import * as vscode from "vscode";
import { t } from "@/locale/i18n";
import { GitGraphViewProvider } from "@/views/GitGraphViewProvider";

export class ViewCommandGroup implements ICommandGroup {
    constructor(
        private readonly _registry: DataManagerRegistry,
        private readonly _graphProvider: GitGraphViewProvider,
        private readonly _extensionUri: vscode.Uri,
    ) { }

    register(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand("git-wiz.switchRepository", async () => {
                const gitExtension = vscode.extensions.getExtension("vscode.git");
                if (gitExtension) {
                    if (!gitExtension.isActive) {
                        await gitExtension.activate();
                    }
                    const api = gitExtension.exports.getAPI(1);
                    if (api && api.repositories && api.repositories.length > 0) {
                        const repos = api.repositories;
                        if (repos.length === 1) {
                            const repoPath = repos[0].rootUri.fsPath;
                            if (this._graphProvider.cwd === repoPath) {
                                vscode.window.showInformationMessage(t(vscode.env.language, "alreadyAtRepository"));
                            }
                            else {
                                this._graphProvider.updateCwd(repoPath);
                            }
                            return;
                        }

                        const items: (vscode.QuickPickItem & { path: string })[] = repos.map((repo: any) => {
                            const path = repo.rootUri.fsPath;
                            const name = path.split(/[\\/]/).pop() || path;
                            return {
                                label: name,
                                description: path,
                                path,
                            };
                        });

                        const selected = await vscode.window.showQuickPick(items, {
                            placeHolder: t(vscode.env.language, "selectRepository"),
                        });

                        if (selected) {
                            this._graphProvider.updateCwd(selected.path);
                        }
                        return;
                    }
                }

                // Fallback to workspace folders if Git extension is not available or has no repos
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    vscode.window.showInformationMessage(t(vscode.env.language, "noWorkspaceFolders"));
                    return;
                }

                if (workspaceFolders.length === 1) {
                    const folderPath = workspaceFolders[0].uri.fsPath;
                    if (this._graphProvider.cwd === folderPath) {
                        vscode.window.showInformationMessage(t(vscode.env.language, "alreadyAtRepository"));
                    }
                    else {
                        this._graphProvider.updateCwd(folderPath);
                    }
                    return;
                }

                const items = workspaceFolders.map(folder => ({
                    label: folder.name,
                    description: folder.uri.fsPath,
                    folder,
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: t(vscode.env.language, "selectRepository"),
                });

                if (selected) {
                    this._graphProvider.updateCwd(selected.folder.uri.fsPath);
                }
            }),

            vscode.commands.registerCommand("git-wiz.showGraph", () => {
                const manager = this._registry.getActiveManager();
                if (manager) {
                    GitGraphViewProvider.createOrShow(this._extensionUri, manager.cwd, this._registry);
                }
                else {
                    vscode.window.showErrorMessage("Git Wiz: Cannot determine active repository context.");
                }
            }),

            vscode.commands.registerCommand("git-wiz.showFileHistory", (uri?: vscode.Uri) => {
                let filePath: string | undefined;
                let targetManager = this._registry.getActiveManager();

                if (uri) {
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
                    if (workspaceFolder) {
                        targetManager = this._registry.getManagerForPath(workspaceFolder.uri.fsPath);
                        filePath = vscode.workspace.asRelativePath(uri, false);
                    }
                    else {
                        filePath = vscode.workspace.asRelativePath(uri);
                    }
                }
                else {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
                        if (workspaceFolder) {
                            targetManager = this._registry.getManagerForPath(workspaceFolder.uri.fsPath);
                            filePath = vscode.workspace.asRelativePath(editor.document.uri, false);
                        }
                        else {
                            filePath = vscode.workspace.asRelativePath(editor.document.uri);
                        }
                    }
                }

                if (filePath && targetManager) {
                    vscode.commands.executeCommand("gitLeanGraphView.focus");
                    this._graphProvider.filterByFile(filePath);
                }
            }),

            vscode.commands.registerCommand("git-wiz.toggleSetting", async () => {
                this._graphProvider.showSettings();
            }),

            vscode.commands.registerCommand("git-wiz.refreshBranches", async () => {
                this._graphProvider.setLoading(true);
                try {
                    this._graphProvider.refresh();
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                finally {
                    this._graphProvider.setLoading(false);
                }
            }),
        );
    }
}
