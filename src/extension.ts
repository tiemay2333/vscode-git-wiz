import * as vscode from "vscode";
import { GitGraphViewProvider } from "./views/gitGraphView";
import { GitService } from "./git/core/gitOperations";
import { DeleteBranchWorkflow } from "./git/workflow/impl/DeleteBranchWorkflow";
import { CherryPickWorkflow } from "./git/workflow/impl/CherryPickWorkflow";
import { RevertWorkflow } from "./git/workflow/impl/RevertWorkflow";
import { ResetWorkflow } from "./git/workflow/impl/ResetWorkflow";
import { DeleteRemoteBranchWorkflow } from "./git/workflow/impl/DeleteRemoteBranchWorkflow";
import { t } from "./locale/i18n";
import { FetchWorkflow } from "./git/workflow/impl/FetchWorkflow";
import { PullWorkflow } from "./git/workflow/impl/PullWorkflow";
import { PushWorkflow } from "./git/workflow/impl/PushWorkflow";
import { RebaseBranchWorkflow } from "./git/workflow/impl/RebaseBranchWorkflow";
import { MergeBranchWorkflow } from "./git/workflow/impl/MergeBranchWorkflow";
import { CreateBranchWorkflow } from "./git/workflow/impl/CreateBranchWorkflow";
import { CreateTagWorkflow } from "./git/workflow/impl/CreateTagWorkflow";
import { PushTagWorkflow } from "./git/workflow/impl/PushTagWorkflow";
import { CheckoutBranchWorkflow } from "./git/workflow/impl/CheckoutBranchWorkflow";

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

    const graphProvider = new GitGraphViewProvider(context.extensionUri);
    context.subscriptions.push(graphProvider);

    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    const gitService = new GitService({ cwd });

    const provider = new (class implements vscode.TextDocumentContentProvider {
        async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
            try {
                const params = new URLSearchParams(uri.query);
                const hash = params.get("hash");
                const fileParam = params.get("file");
                if (!hash) {
                    return "";
                }
                const service = new GitService({ cwd });
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
            GitGraphViewProvider.createOrShow(context.extensionUri);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.showFileHistory", (uri?: vscode.Uri) => {
            let filePath: string | undefined;
            if (uri) {
                filePath = vscode.workspace.asRelativePath(uri);
            }
            else {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    filePath = vscode.workspace.asRelativePath(editor.document.uri);
                }
            }
            if (filePath) {
                vscode.commands.executeCommand("gitLeanGraphView.focus");
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
        vscode.commands.registerCommand("git-wiz.refreshBranches", () => {
            vscode.window.withProgress(
                { location: vscode.ProgressLocation.Window, title: "Refreshing Branches..." },
                async () => {
                    graphProvider.refresh();
                    await new Promise(resolve => setTimeout(resolve, 500));
                },
            );
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
                btnPush, btnCancel
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

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Window, title: `Deleting ${label}...` },
                async () => {
                    const deleted: string[] = [];
                    const notMerged: string[] = [];
                    const failed: { name: string; error: string }[] = [];

                    for (const name of branchNames) {
                        try {
                            await gitService.deleteBranch(name, false);
                            deleted.push(name);
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
                                    await gitService.deleteBranch(name, true);
                                    deleted.push(name);
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
                },
            );
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
                btnDelete, btnCancel
            );
            if (confirm === btnDelete) {
                await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Window, title: t(vscode.env.language, "tagDeleteTitle", { name: tagName }) },
                    async () => {
                        try {
                            await gitService.deleteTag(tagName);
                            vscode.window.showInformationMessage(t(vscode.env.language, "tagDeleteSuccess", { name: tagName }));
                            vscode.commands.executeCommand("git-wiz.refreshBranches");
                            graphProvider.refresh();
                        }
                        catch (err: any) {
                            vscode.window.showErrorMessage(err.message);
                        }
                    },
                );
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

export function deactivate() {}
