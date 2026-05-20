import * as vscode from "vscode";
import { CheckoutBranchWorkflow } from "./git/workflow/impl/CheckoutBranchWorkflow";
import { CherryPickWorkflow } from "./git/workflow/impl/CherryPickWorkflow";
import { CreateBranchWorkflow } from "./git/workflow/impl/CreateBranchWorkflow";
import { DeleteBranchWorkflow } from "./git/workflow/impl/DeleteBranchWorkflow";
import { DeleteRemoteBranchWorkflow } from "./git/workflow/impl/DeleteRemoteBranchWorkflow";
import { FetchWorkflow } from "./git/workflow/impl/FetchWorkflow";
import { MergeBranchWorkflow } from "./git/workflow/impl/MergeBranchWorkflow";
import { PullWorkflow } from "./git/workflow/impl/PullWorkflow";
import { PushTagWorkflow } from "./git/workflow/impl/PushTagWorkflow";
import { PushWorkflow } from "./git/workflow/impl/PushWorkflow";
import { RebaseBranchWorkflow } from "./git/workflow/impl/RebaseBranchWorkflow";
import { ResetWorkflow } from "./git/workflow/impl/ResetWorkflow";
import { RevertWorkflow } from "./git/workflow/impl/RevertWorkflow";
import { t } from "./locale/i18n";
import { GitGraphViewProvider } from "./views/GitGraphViewProvider";
import { ViewDataManager } from "./views/ViewDataManager";

export function activate(context: vscode.ExtensionContext) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(git-branch) Git Wiz";
    statusBarItem.tooltip = "Open Git Wiz Panel";
    statusBarItem.command = "workbench.view.extension.git-wiz";

    const updateStatusBar = () => {
        const config = vscode.workspace.getConfiguration();
        if (config.get("git-wiz.showStatusBarItem", true)) {
            statusBarItem.show();
        }
        else {
            statusBarItem.hide();
        }
    };

    updateStatusBar();
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("git-wiz.showStatusBarItem")) {
                updateStatusBar();
            }
        }),
    );

    ViewDataManager.setupWorkspaceWatcher();

    const getActiveManager = () => {
        const manager = ViewDataManager.getActiveManager();
        if (!manager) {
            vscode.window.showErrorMessage("Git Wiz: Cannot determine active repository context.");
        }
        return manager;
    };

    const defaultCwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    const graphProvider = new GitGraphViewProvider(context.extensionUri, defaultCwd);
    context.subscriptions.push(graphProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.switchRepository", async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showInformationMessage("No workspace folders found.");
                return;
            }

            if (workspaceFolders.length === 1) {
                graphProvider.updateCwd(workspaceFolders[0].uri.fsPath);
                return;
            }

            const items = workspaceFolders.map(folder => ({
                label: folder.name,
                description: folder.uri.fsPath,
                folder,
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: "Select a repository to show in Git Wiz",
            });

            if (selected) {
                graphProvider.updateCwd(selected.folder.uri.fsPath);
            }
        }),
    );

    const provider = new (class implements vscode.TextDocumentContentProvider {
        async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
            try {
                const params = new URLSearchParams(uri.query);
                const hash = params.get("hash");
                const fileParam = params.get("file");
                if (!hash) {
                    return "";
                }
                const service = ViewDataManager.getActiveManager()?.gitService;
                if (!service)
                    return "";
                return await service.getFileContentAtRev(hash, fileParam || uri.path.substring(1));
            }
            catch {
                return "";
            }
        }
    })();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("git-wiz", provider));

    context.subscriptions.push(vscode.window.registerWebviewViewProvider(GitGraphViewProvider.viewType, graphProvider));

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.showGraph", () => {
            const manager = getActiveManager();
            if (manager) {
                GitGraphViewProvider.createOrShow(context.extensionUri, manager.cwd);
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.showFileHistory", (uri?: vscode.Uri) => {
            let filePath: string | undefined;
            let targetManager = ViewDataManager.getActiveManager();

            if (uri) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
                if (workspaceFolder) {
                    targetManager = ViewDataManager.getManagerForPath(workspaceFolder.uri.fsPath);
                    filePath = vscode.workspace.asRelativePath(uri, false); // relative to workspace folder
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
                        targetManager = ViewDataManager.getManagerForPath(workspaceFolder.uri.fsPath);
                        filePath = vscode.workspace.asRelativePath(editor.document.uri, false);
                    }
                    else {
                        filePath = vscode.workspace.asRelativePath(editor.document.uri);
                    }
                }
            }

            if (filePath && targetManager) {
                vscode.commands.executeCommand("gitLeanGraphView.focus");
                // For the sidebar view, we might need to update its CWD or recreate it.
                // Currently it's bound to the first workspace. To keep it simple:
                graphProvider.filterByFile(filePath);
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.cherryPick", async (commitHash: string) => {
            await graphProvider.executeWorkflow(new CherryPickWorkflow([commitHash]));
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.copyHash", (commitHash: string) => {
            graphProvider.copyCommitHash(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.revertCommit", async (commitHash: string) => {
            await graphProvider.executeWorkflow(new RevertWorkflow([commitHash]));
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.resetToCommit", async (commitHash: string) => {
            await graphProvider.executeWorkflow(new ResetWorkflow(commitHash));
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.checkoutBranch", async (item: string | { branchName: string; isRemote?: boolean }) => {
            const branchName = typeof item === "string" ? item : item.branchName;
            const isRemote = typeof item === "object" ? item.isRemote : branchName.includes("/");
            if (branchName) {
                await graphProvider.executeWorkflow(new CheckoutBranchWorkflow(branchName, { track: isRemote }));
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.checkoutRemoteBranch", async (item: string | { branchName: string }) => {
            const branchName = typeof item === "string" ? item : item.branchName;
            if (!branchName)
                return;

            const parts = branchName.split("/");
            if (parts.length < 2)
                return;

            const remote = parts[0];
            await graphProvider.executeWorkflow(new CheckoutBranchWorkflow(branchName, { remote }));
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.deleteBranch", async (branchTreeItem: { branchName: string }) => {
            const branchName = branchTreeItem.branchName;
            if (branchName) {
                await graphProvider.executeWorkflow(new DeleteBranchWorkflow(branchName));
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.deleteRemoteBranch", async (item: string | { branchName: string }) => {
            const fullName = typeof item === "string" ? item : item.branchName;
            if (fullName) {
                await graphProvider.executeWorkflow(new DeleteRemoteBranchWorkflow(fullName));
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.toggleSetting", async () => {
            graphProvider.showSettings();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.refreshBranches", async () => {
            graphProvider.setLoading(true);
            try {
                graphProvider.refresh();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            finally {
                graphProvider.setLoading(false);
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.fetch", async () => {
            await graphProvider.executeWorkflow(new FetchWorkflow({ all: true }));
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.pull", async () => {
            await graphProvider.executeWorkflow(new PullWorkflow());
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.push", async () => {
            await graphProvider.executeWorkflow(new PushWorkflow());
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.pushForce", async () => {
            const btnPush = t(vscode.env.language, "pushForceConfirm");
            const btnCancel = t(vscode.env.language, "cancel");
            const confirm = await vscode.window.showWarningMessage(
                t(vscode.env.language, "pushForceConfirm"),
                btnPush,
                btnCancel,
            );
            if (confirm === btnPush) {
                await graphProvider.executeWorkflow(new PushWorkflow({ force: true }));
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.rebaseBranch", async (branchTreeItem: { branchName: string }) => {
            const targetBranch = branchTreeItem.branchName;
            if (targetBranch) {
                await graphProvider.executeWorkflow(new RebaseBranchWorkflow(targetBranch));
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.mergeBranch", async (branchTreeItem: { branchName: string }) => {
            const sourceBranch = branchTreeItem.branchName;
            if (sourceBranch) {
                await graphProvider.executeWorkflow(new MergeBranchWorkflow(sourceBranch));
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.deleteMultipleBranches", async (branchNames: string[]) => {
            if (!branchNames || branchNames.length === 0) {
                return;
            }

            const label = branchNames.length === 1 ? `branch '${branchNames[0]}'` : `${branchNames.length} branches`;
            const confirm = await vscode.window.showWarningMessage(
                `Delete ${label}?`,
                { detail: branchNames.join(", ") },
                "Yes",
                "No",
            );
            if (confirm !== "Yes") {
                return;
            }

            graphProvider.setLoading(true);
            try {
                const deleted: string[] = [];
                const notMerged: string[] = [];
                const failed: { name: string; error: string }[] = [];

                for (const name of branchNames) {
                    try {
                        await graphProvider.executeWorkflow({
                            label: "delete branch",
                            run: async (ctx: any) => {
                                await ctx.git.deleteBranch(name, false);
                                deleted.push(name);
                            },
                        } as any);
                    }
                    catch (err: any) {
                        if (err.message.includes("not fully merged")) {
                            notMerged.push(name);
                        }
                        else {
                            failed.push({ name, error: err.message });
                        }
                    }
                }

                if (failed.length > 0) {
                    vscode.window.showErrorMessage(`Failed to delete: ${failed.map(r => r.name).join(", ")}`);
                }

                if (notMerged.length > 0) {
                    const notMergedLabel = notMerged.length === 1 ? `Branch '${notMerged[0]}' is` : `${notMerged.length} branches are`;
                    const forceConfirm = await vscode.window.showWarningMessage(
                        `${notMergedLabel} not fully merged. Force delete?`,
                        { detail: notMerged.join(", ") },
                        "Force Delete",
                        "Cancel",
                    );
                    if (forceConfirm === "Force Delete") {
                        for (const name of notMerged) {
                            try {
                                await graphProvider.executeWorkflow({
                                    label: "force delete branch",
                                    run: async (ctx: any) => {
                                        await ctx.git.deleteBranch(name, true);
                                        deleted.push(name);
                                    },
                                } as any);
                            }
                            catch (err: any) {
                                vscode.window.showErrorMessage(`Failed to force delete '${name}': ${err.message}`);
                            }
                        }
                    }
                }

                if (deleted.length > 0) {
                    vscode.window.showInformationMessage(`Deleted ${deleted.length} branch${deleted.length > 1 ? "es" : ""}`);
                }

                graphProvider.refresh();
            }
            finally {
                graphProvider.setLoading(false);
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.createBranchFromTag", async (tagName: string) => {
            await graphProvider.executeWorkflow(new CreateBranchWorkflow(tagName));
        }),
        vscode.commands.registerCommand("git-wiz.pushTag", async (tagName: string) => {
            await graphProvider.executeWorkflow(new PushTagWorkflow(tagName));
        }),
        vscode.commands.registerCommand("git-wiz.deleteTag", async (tagName: string) => {
            const btnDelete = t(vscode.env.language, "confirm");
            const btnCancel = t(vscode.env.language, "cancel");
            const confirm = await vscode.window.showWarningMessage(
                t(vscode.env.language, "tagDeleteConfirm", { name: tagName }),
                btnDelete,
                btnCancel,
            );
            if (confirm === btnDelete) {
                graphProvider.setLoading(true);
                try {
                    await graphProvider.executeWorkflow({
                        label: "delete tag",
                        run: async (ctx: any) => {
                            await ctx.git.deleteTag(tagName);
                            vscode.window.showInformationMessage(t(vscode.env.language, "tagDeleteSuccess", { name: tagName }));
                        },
                    } as any);
                    vscode.commands.executeCommand("git-wiz.refreshBranches");
                    graphProvider.refresh();
                }
                catch (err: any) {
                    vscode.window.showErrorMessage(err.message);
                }
                finally {
                    graphProvider.setLoading(false);
                }
            }
        }),
        vscode.commands.registerCommand("git-wiz.createBranch", async (branchTreeItem: { branchName: string }) => {
            const sourceBranch = branchTreeItem.branchName;
            if (sourceBranch) {
                await graphProvider.executeWorkflow(new CreateBranchWorkflow(sourceBranch));
            }
        }),
    );
}

export function deactivate() { }
