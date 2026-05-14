import * as vscode from "vscode";
import { GitGraphViewProvider } from "./gitGraphView";
import { GitService } from "./gitOperations";

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
        vscode.commands.registerCommand("git-wiz.cherryPick", (commitHash: string) => {
            graphProvider.cherryPickCommit(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.copyHash", (commitHash: string) => {
            graphProvider.copyCommitHash(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.revertCommit", (commitHash: string) => {
            graphProvider.revertCommit(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.resetToCommit", (commitHash: string) => {
            graphProvider.resetToCommit(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.checkoutBranch", async (item: string | { branchName: string; isRemote?: boolean }) => {
            const branchName = typeof item === "string" ? item : item.branchName;
            const isRemote = typeof item === "object" ? item.isRemote : branchName.includes("/");
            if (!branchName)
                return;

            try {
                await gitService.checkoutBranch(branchName, { track: isRemote });
                vscode.window.showInformationMessage(`Switched to branch '${branchName}'`);
            }
            catch {
                // Fallback: simple checkout if --track fails
                try {
                    await gitService.checkoutBranch(branchName);
                    vscode.window.showInformationMessage(`Switched to tracking branch '${branchName}'`);
                }
                catch (fallbackErr: any) {
                    vscode.window.showErrorMessage(`Failed to checkout branch: ${fallbackErr.message}`);
                }
            }
            graphProvider.refresh();
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
            const localBranchName = parts.slice(1).join("/");

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: `Fetching ${remote} and tracking ${branchName}...`,
                cancellable: false,
            }, async () => {
                try {
                    await gitService.fetch({ remote });
                    await gitService.checkoutBranch(branchName, { track: true });
                    vscode.window.showInformationMessage(`Checked out and tracking '${branchName}'`);
                }
                catch (err: any) {
                    try {
                        await gitService.checkoutBranch(localBranchName);
                        vscode.window.showInformationMessage(`Switched to existing branch '${localBranchName}'`);
                    }
                    catch {
                        vscode.window.showErrorMessage(`Failed to checkout remote branch: ${err.message}`);
                    }
                }
                graphProvider.refresh();
            });
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.deleteBranch", async (branchTreeItem: { branchName: string }) => {
            const branchName = branchTreeItem.branchName;
            if (!branchName)
                return;

            const upstream = await gitService.getUpstream(branchName);

            let confirm: string | undefined;
            if (upstream) {
                confirm = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete branch '${branchName}'? It has a remote tracking branch '${upstream}'.`,
                    "Delete Both",
                    "Delete Local",
                    "Cancel",
                );
            }
            else {
                confirm = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete branch '${branchName}'?`,
                    "Yes",
                    "No",
                );
            }

            if (!["Yes", "Delete Local", "Delete Both"].includes(confirm || "")) {
                return;
            }

            const doDeleteRemote = confirm === "Delete Both";

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Window, title: `Deleting branch '${branchName}'...` },
                async () => {
                    try {
                        await gitService.deleteBranch(branchName, false);
                    }
                    catch (err: any) {
                        if (err.message.includes("not fully merged")) {
                            const forceConfirm = await vscode.window.showWarningMessage(
                                `Branch '${branchName}' is not fully merged. Force delete anyway?`,
                                "Force Delete",
                                "Cancel",
                            );
                            if (forceConfirm !== "Force Delete") {
                                return;
                            }
                            try {
                                await gitService.deleteBranch(branchName, true);
                            }
                            catch (err2: any) {
                                vscode.window.showErrorMessage(err2.message);
                                return;
                            }
                        }
                        else {
                            vscode.window.showErrorMessage(err.message);
                            return;
                        }
                    }

                    if (doDeleteRemote && upstream) {
                        try {
                            const firstSlash = upstream.indexOf("/");
                            if (firstSlash !== -1) {
                                const remoteName = upstream.substring(0, firstSlash);
                                const remoteBranch = upstream.substring(firstSlash + 1);
                                await gitService.deleteRemoteBranch(remoteName, remoteBranch);
                                vscode.window.showInformationMessage(`Deleted branch '${branchName}' and its remote tracking branch '${upstream}'`);
                            }
                        }
                        catch (err: any) {
                            vscode.window.showErrorMessage(`Deleted local branch, but failed to delete remote branch: ${err.message}`);
                        }
                    }
                    else {
                        vscode.window.showInformationMessage(`Deleted branch '${branchName}'`);
                    }

                    graphProvider.refresh();
                },
            );
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.deleteRemoteBranch", async (item: string | { branchName: string }) => {
            const fullName = typeof item === "string" ? item : item.branchName;
            if (!fullName) {
                return;
            }

            const firstSlash = fullName.indexOf("/");
            if (firstSlash === -1) {
                vscode.window.showErrorMessage(`Invalid remote branch name: ${fullName}`);
                return;
            }

            const remote = fullName.substring(0, firstSlash);
            const branch = fullName.substring(firstSlash + 1);

            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete remote branch '${branch}' from '${remote}'?`,
                { modal: true },
                "Delete Remote Branch",
            );

            if (confirm !== "Delete Remote Branch") {
                return;
            }

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Window, title: `Deleting remote branch '${branch}'...` },
                async () => {
                    try {
                        await gitService.deleteRemoteBranch(remote, branch);
                        vscode.window.showInformationMessage(`Deleted remote branch '${branch}' from '${remote}'`);
                        graphProvider.refresh();
                    }
                    catch (err: any) {
                        vscode.window.showErrorMessage(`Failed to delete remote branch: ${err.message}`);
                    }
                },
            );
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
        vscode.commands.registerCommand("git-wiz.fetch", () => {
            vscode.window.withProgress(
                { location: vscode.ProgressLocation.Window, title: "Fetching..." },
                async () => {
                    try {
                        await gitService.fetch({ all: true });
                        vscode.window.showInformationMessage("Fetch successful");
                        graphProvider.refresh();
                    }
                    catch (err: any) {
                        vscode.window.showErrorMessage(`Fetch failed: ${err.message}`);
                    }
                },
            );
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.pull", () => {
            vscode.window.withProgress(
                { location: vscode.ProgressLocation.Window, title: "Pulling..." },
                async () => {
                    try {
                        await gitService.pull();
                        vscode.window.showInformationMessage("Pull successful");
                        graphProvider.refresh();
                    }
                    catch (err: any) {
                        vscode.window.showErrorMessage(`Pull failed: ${err.message}`);
                    }
                },
            );
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.push", () => {
            vscode.window.withProgress(
                { location: vscode.ProgressLocation.Window, title: "Pushing..." },
                async () => {
                    try {
                        await gitService.push();
                        vscode.window.showInformationMessage("Push successful");
                        graphProvider.refresh();
                    }
                    catch (err: any) {
                        if (err.message.includes("has no upstream branch")) {
                            const branch = await gitService.getCurrentBranch();
                            if (!branch) {
                                vscode.window.showErrorMessage(`Push failed: ${err.message}`);
                                return;
                            }
                            try {
                                await gitService.push({ setUpstream: branch });
                                vscode.window.showInformationMessage("Push successful (set upstream to origin)");
                                graphProvider.refresh();
                            }
                            catch (pushErr: any) {
                                vscode.window.showErrorMessage(`Push failed: ${pushErr.message}`);
                            }
                        }
                        else {
                            vscode.window.showErrorMessage(`Push failed: ${err.message}`);
                        }
                    }
                },
            );
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.pushForce", async () => {
            const confirm = await vscode.window.showWarningMessage(
                "Force push will overwrite remote history. Are you sure?",
                "Force Push",
                "Cancel",
            );
            if (confirm !== "Force Push") {
                return;
            }
            vscode.window.withProgress(
                { location: vscode.ProgressLocation.Window, title: "Force Pushing..." },
                async () => {
                    try {
                        await gitService.push({ force: true });
                        vscode.window.showInformationMessage("Force push successful");
                        graphProvider.refresh();
                    }
                    catch (err: any) {
                        if (err.message.includes("has no upstream branch")) {
                            const branch = await gitService.getCurrentBranch();
                            if (!branch) {
                                vscode.window.showErrorMessage(`Force push failed: ${err.message}`);
                                return;
                            }
                            try {
                                await gitService.push({ force: true, setUpstream: branch });
                                vscode.window.showInformationMessage("Force push successful (set upstream to origin)");
                                graphProvider.refresh();
                            }
                            catch (pushErr: any) {
                                vscode.window.showErrorMessage(`Force push failed: ${pushErr.message}`);
                            }
                        }
                        else {
                            vscode.window.showErrorMessage(`Force push failed: ${err.message}`);
                        }
                    }
                },
            );
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.rebaseBranch", async (branchTreeItem: { branchName: string }) => {
            const targetBranch = branchTreeItem.branchName;
            if (targetBranch) {
                try {
                    await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Rebasing onto '${targetBranch}'...` }, async () => {
                        await gitService.rebaseBranch(targetBranch);
                        vscode.window.showInformationMessage(`Rebased onto '${targetBranch}' successfully`);
                        graphProvider.refresh();
                    });
                }
                catch (err: any) {
                    vscode.window.showErrorMessage(err.message);
                    graphProvider.refresh();
                }
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.mergeBranch", async (branchTreeItem: { branchName: string }) => {
            const sourceBranch = branchTreeItem.branchName;
            if (sourceBranch) {
                try {
                    await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Merging '${sourceBranch}'...` }, async () => {
                        const result = await gitService.mergeBranch(sourceBranch);
                        if (!result.success) {
                            if (result.isConflict) {
                                const choice = await vscode.window.showErrorMessage(`Merge failed with conflicts: ${result.error}`, "Abort Merge", "Close");
                                if (choice === "Abort Merge") {
                                    await gitService.abortMerge();
                                    vscode.window.showInformationMessage("Merge aborted");
                                }
                            }
                            else {
                                vscode.window.showErrorMessage(`Merge failed: ${result.error}`);
                            }
                        }
                        else {
                            vscode.window.showInformationMessage(`Merged '${sourceBranch}' successfully`);
                        }
                        graphProvider.refresh();
                    });
                }
                catch (err: any) {
                    vscode.window.showErrorMessage(err.message);
                    graphProvider.refresh();
                }
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
            const branchName = await vscode.window.showInputBox({
                prompt: `Enter new branch name for tag '${tagName}'`,
                placeHolder: "e.g. feature/new-branch",
            });
            if (branchName) {
                if (graphProvider) {
                    await graphProvider.createBranchFromCommit(tagName, branchName);
                }
            }
        }),
        vscode.commands.registerCommand("git-wiz.pushTag", async (tagName: string) => {
            if (graphProvider) {
                await graphProvider.pushTag(tagName);
            }
        }),
        vscode.commands.registerCommand("git-wiz.deleteTag", async (tagName: string) => {
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete tag '${tagName}'?`,
                "Delete",
                "Cancel",
            );
            if (confirm === "Delete") {
                await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Window, title: `Deleting tag '${tagName}'...` },
                    async () => {
                        try {
                            await gitService.deleteTag(tagName);
                            vscode.window.showInformationMessage(`Tag '${tagName}' deleted successfully`);
                            vscode.commands.executeCommand("git-wiz.refreshBranches");
                            graphProvider.refresh();
                        }
                        catch (err: any) {
                            vscode.window.showErrorMessage(`Failed to delete tag: ${err.message}`);
                        }
                    },
                );
            }
        }),
        vscode.commands.registerCommand("git-wiz.createBranch", async (branchTreeItem: { branchName: string }) => {
            const sourceBranch = branchTreeItem.branchName;
            if (!sourceBranch) {
                return;
            }
            const newBranchName = await vscode.window.showInputBox({
                prompt: `Create new branch from '${sourceBranch}'`,
                placeHolder: "New branch name",
                validateInput: (value) => {
                    if (!value || !value.trim()) {
                        return "Branch name cannot be empty";
                    }
                    if (/[\s~^:?*[\\]|\.\./.test(value)) {
                        return "Invalid branch name";
                    }
                    return null;
                },
            });

            if (!newBranchName) {
                return;
            }

            try {
                await gitService.checkoutBranch(newBranchName, { create: true });
                vscode.window.showInformationMessage(`Created and switched to branch '${newBranchName}'`);
                graphProvider.refresh();
            }
            catch (err: any) {
                vscode.window.showErrorMessage(`Failed to create branch: ${err.message}`);
            }
        }),
    );
}

export function deactivate() {}
