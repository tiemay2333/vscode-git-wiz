import * as vscode from "vscode";
import { GitGraphViewProvider } from "./gitGraphView";
import { GitOperations } from "./gitOperations";

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

    const gitOps = new GitOperations(() => {
        graphProvider.refresh();
    });

    const provider = new (class implements vscode.TextDocumentContentProvider {
        async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
            try {
                const params = new URLSearchParams(uri.query);
                const hash = params.get("hash");
                const fileParam = params.get("file");
                if (!hash) {
                    return "";
                }
                const ops = new GitOperations(() => {});
                return await ops.getFileContentAtRev(hash, fileParam || uri.path.substring(1));
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

            const args = isRemote ? ["checkout", "--track", branchName] : ["checkout", branchName];

            const result = await gitOps.getRunner().exec(args);
            if (result.exitCode !== 0) {
                // Fallback: simple checkout if --track fails
                const fallback = await gitOps.getRunner().exec(["checkout", branchName]);
                if (fallback.exitCode !== 0) {
                    vscode.window.showErrorMessage(`Failed to checkout branch: ${fallback.stderr}`);
                    return;
                }
                vscode.window.showInformationMessage(`Switched to tracking branch '${branchName}'`);
            }
            else {
                vscode.window.showInformationMessage(`Switched to branch '${branchName}'`);
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
                const fetchResult = await gitOps.getRunner().exec(["fetch", remote]);
                if (fetchResult.exitCode !== 0) {
                    vscode.window.showErrorMessage(`Failed to fetch remote '${remote}': ${fetchResult.stderr}`);
                    return;
                }

                const checkoutResult = await gitOps.getRunner().exec(["checkout", "-t", branchName]);
                if (checkoutResult.exitCode !== 0) {
                    // Fallback: checkout existing local branch
                    const fallback = await gitOps.getRunner().exec(["checkout", localBranchName]);
                    if (fallback.exitCode !== 0) {
                        vscode.window.showErrorMessage(`Failed to checkout remote branch: ${checkoutResult.stderr}`);
                        return;
                    }
                    vscode.window.showInformationMessage(`Switched to existing branch '${localBranchName}'`);
                }
                else {
                    vscode.window.showInformationMessage(`Checked out and tracking '${branchName}'`);
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

            const upstreamResult = await gitOps.getRunner().exec(["rev-parse", "--abbrev-ref", `${branchName}@{upstream}`]);
            const upstream = upstreamResult.exitCode === 0 ? upstreamResult.stdout.trim() : null;

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
                    const deleteLocalCommand = async (force: boolean): Promise<void> => {
                        const result = await gitOps.getRunner().exec(["branch", force ? "-D" : "-d", branchName]);
                        if (result.exitCode !== 0) {
                            if (!force && result.stderr.includes("not fully merged")) {
                                throw new Error("not fully merged");
                            }
                            throw new Error(`Failed to delete branch: ${result.stderr}`);
                        }
                    };

                    const deleteRemoteCommand = async (remoteStr: string): Promise<void> => {
                        const firstSlash = remoteStr.indexOf("/");
                        if (firstSlash === -1)
                            return;
                        const remoteName = remoteStr.substring(0, firstSlash);
                        const remoteBranch = remoteStr.substring(firstSlash + 1);

                        const result = await gitOps.getRunner().exec(["push", remoteName, "--delete", remoteBranch]);
                        if (result.exitCode !== 0) {
                            throw new Error(result.stderr);
                        }
                    };

                    try {
                        await deleteLocalCommand(false);
                    }
                    catch (err: any) {
                        if (err.message === "not fully merged") {
                            const forceConfirm = await vscode.window.showWarningMessage(
                                `Branch '${branchName}' is not fully merged. Force delete anyway?`,
                                "Force Delete",
                                "Cancel",
                            );
                            if (forceConfirm !== "Force Delete") {
                                return;
                            }
                            try {
                                await deleteLocalCommand(true);
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
                            await deleteRemoteCommand(upstream);
                            vscode.window.showInformationMessage(`Deleted branch '${branchName}' and its remote tracking branch '${upstream}'`);
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
                    const result = await gitOps.getRunner().exec(["push", remote, "--delete", branch]);
                    if (result.exitCode !== 0) {
                        vscode.window.showErrorMessage(`Failed to delete remote branch: ${result.stderr}`);
                    }
                    else {
                        vscode.window.showInformationMessage(`Deleted remote branch '${branch}' from '${remote}'`);
                        graphProvider.refresh();
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
                    const result = await gitOps.getRunner().exec(["fetch", "--all"]);
                    if (result.exitCode !== 0) {
                        vscode.window.showErrorMessage(`Fetch failed: ${result.stderr}`);
                    }
                    else {
                        vscode.window.showInformationMessage("Fetch successful");
                        graphProvider.refresh();
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
                    const result = await gitOps.getRunner().exec(["pull"]);
                    if (result.exitCode !== 0) {
                        vscode.window.showErrorMessage(`Pull failed: ${result.stderr}`);
                    }
                    else {
                        vscode.window.showInformationMessage("Pull successful");
                        graphProvider.refresh();
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
                    const result = await gitOps.getRunner().exec(["push"]);
                    if (result.exitCode !== 0) {
                        if (result.stderr.includes("has no upstream branch")) {
                            const branchResult = await gitOps.getRunner().exec(["rev-parse", "--abbrev-ref", "HEAD"]);
                            if (branchResult.exitCode !== 0) {
                                vscode.window.showErrorMessage(`Push failed: ${result.stderr}`);
                                return;
                            }
                            const branch = branchResult.stdout.trim();
                            const pushResult = await gitOps.getRunner().exec(["push", "-u", "origin", branch]);
                            if (pushResult.exitCode !== 0) {
                                vscode.window.showErrorMessage(`Push failed: ${pushResult.stderr}`);
                            }
                            else {
                                vscode.window.showInformationMessage("Push successful (set upstream to origin)");
                                graphProvider.refresh();
                            }
                        }
                        else {
                            vscode.window.showErrorMessage(`Push failed: ${result.stderr}`);
                        }
                    }
                    else {
                        vscode.window.showInformationMessage("Push successful");
                        graphProvider.refresh();
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
                    const result = await gitOps.getRunner().exec(["push", "--force-with-lease"]);
                    if (result.exitCode !== 0) {
                        if (result.stderr.includes("has no upstream branch")) {
                            const branchResult = await gitOps.getRunner().exec(["rev-parse", "--abbrev-ref", "HEAD"]);
                            if (branchResult.exitCode !== 0) {
                                vscode.window.showErrorMessage(`Force push failed: ${result.stderr}`);
                                return;
                            }
                            const branch = branchResult.stdout.trim();
                            const pushResult = await gitOps.getRunner().exec(["push", "--force-with-lease", "-u", "origin", branch]);
                            if (pushResult.exitCode !== 0) {
                                vscode.window.showErrorMessage(`Force push failed: ${pushResult.stderr}`);
                            }
                            else {
                                vscode.window.showInformationMessage("Force push successful (set upstream to origin)");
                                graphProvider.refresh();
                            }
                        }
                        else {
                            vscode.window.showErrorMessage(`Force push failed: ${result.stderr}`);
                        }
                    }
                    else {
                        vscode.window.showInformationMessage("Force push successful");
                        graphProvider.refresh();
                    }
                },
            );
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.rebaseBranch", async (branchTreeItem: { branchName: string }) => {
            const targetBranch = branchTreeItem.branchName;
            if (targetBranch) {
                await gitOps.rebaseBranch(targetBranch);
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("git-wiz.mergeBranch", async (branchTreeItem: { branchName: string }) => {
            const sourceBranch = branchTreeItem.branchName;
            if (sourceBranch) {
                await gitOps.mergeBranch(sourceBranch);
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
                    const tryDelete = async (
                        name: string,
                        force: boolean,
                    ): Promise<{ name: string; notMerged: boolean; error?: string }> => {
                        const result = await gitOps.getRunner().exec(["branch", force ? "-D" : "-d", name]);
                        if (result.exitCode !== 0) {
                            if (!force && result.stderr.includes("not fully merged")) {
                                return { name, notMerged: true };
                            }
                            else {
                                return { name, notMerged: false, error: result.stderr };
                            }
                        }
                        return { name, notMerged: false };
                    };

                    const results = await Promise.all(branchNames.map(name => tryDelete(name, false)));
                    const notMerged = results.filter(r => r.notMerged).map(r => r.name);
                    const failed = results.filter(r => !r.notMerged && r.error);
                    const deletedCount = results.filter(r => !r.notMerged && !r.error).length;

                    if (failed.length > 0) {
                        vscode.window.showErrorMessage(`Failed to delete: ${failed.map(r => r.name).join(", ")}`);
                    }

                    if (notMerged.length > 0) {
                        const notMergedLabel
                            = notMerged.length === 1 ? `Branch '${notMerged[0]}' is` : `${notMerged.length} branches are`;
                        const forceConfirm = await vscode.window.showWarningMessage(
                            `${notMergedLabel} not fully merged. Force delete?`,
                            { detail: notMerged.join(", ") },
                            "Force Delete",
                            "Cancel",
                        );
                        if (forceConfirm === "Force Delete") {
                            const forceResults = await Promise.all(notMerged.map(name => tryDelete(name, true)));
                            const forceDeleted = forceResults.filter(r => !r.error).length;
                            const forceFailed = forceResults.filter(r => r.error);
                            if (forceFailed.length > 0) {
                                vscode.window.showErrorMessage(
                                    `Failed to force delete: ${forceFailed.map(r => r.name).join(", ")}`,
                                );
                            }
                            const total = deletedCount + forceDeleted;
                            if (total > 0) {
                                vscode.window.showInformationMessage(`Deleted ${total} branch${total > 1 ? "es" : ""}`);
                            }
                        }
                        else if (deletedCount > 0) {
                            vscode.window.showInformationMessage(
                                `Deleted ${deletedCount} branch${deletedCount > 1 ? "es" : ""}`,
                            );
                        }
                    }
                    else if (deletedCount > 0) {
                        vscode.window.showInformationMessage(`Deleted ${deletedCount} branch${deletedCount > 1 ? "es" : ""}`);
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
                        const result = await gitOps.getRunner().exec(["tag", "-d", tagName]);
                        if (result.exitCode !== 0) {
                            vscode.window.showErrorMessage(`Failed to delete tag: ${result.stderr}`);
                        }
                        else {
                            vscode.window.showInformationMessage(`Tag '${tagName}' deleted successfully`);
                            vscode.commands.executeCommand("git-wiz.refreshBranches");
                            if (graphProvider) {
                                graphProvider.refresh();
                            }
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

            const result = await gitOps.getRunner().exec(["checkout", "-b", newBranchName, sourceBranch]);
            if (result.exitCode !== 0) {
                vscode.window.showErrorMessage(`Failed to create branch: ${result.stderr}`);
                return;
            }
            vscode.window.showInformationMessage(`Created and switched to branch '${newBranchName}'`);
            graphProvider.refresh();
        }),
    );
}

export function deactivate() {}
