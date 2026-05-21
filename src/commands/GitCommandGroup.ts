import type { ICommandGroup } from "./ICommandGroup";
import type { GitGraphViewProvider } from "@/views/GitGraphViewProvider";
import * as vscode from "vscode";
import { CheckoutBranchWorkflow } from "@/git/workflow/impl/CheckoutBranchWorkflow";
import { CherryPickWorkflow } from "@/git/workflow/impl/CherryPickWorkflow";
import { CreateBranchWorkflow } from "@/git/workflow/impl/CreateBranchWorkflow";
import { DeleteBranchWorkflow } from "@/git/workflow/impl/DeleteBranchWorkflow";
import { DeleteRemoteBranchWorkflow } from "@/git/workflow/impl/DeleteRemoteBranchWorkflow";
import { FetchWorkflow } from "@/git/workflow/impl/FetchWorkflow";
import { MergeBranchWorkflow } from "@/git/workflow/impl/MergeBranchWorkflow";
import { PullWorkflow } from "@/git/workflow/impl/PullWorkflow";
import { PushTagWorkflow } from "@/git/workflow/impl/PushTagWorkflow";
import { PushWorkflow } from "@/git/workflow/impl/PushWorkflow";
import { RebaseBranchWorkflow } from "@/git/workflow/impl/RebaseBranchWorkflow";
import { ResetWorkflow } from "@/git/workflow/impl/ResetWorkflow";
import { RevertWorkflow } from "@/git/workflow/impl/RevertWorkflow";
import { t } from "@/locale/i18n";

export class GitCommandGroup implements ICommandGroup {
    constructor(private readonly _graphProvider: GitGraphViewProvider) { }

    register(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand("git-wiz.cherryPick", async (commitHash: string) => {
                await this._graphProvider.executeWorkflow(new CherryPickWorkflow([commitHash]));
            }),

            vscode.commands.registerCommand("git-wiz.copyHash", (commitHash: string) => {
                this._graphProvider.copyCommitHash(commitHash);
            }),

            vscode.commands.registerCommand("git-wiz.revertCommit", async (commitHash: string) => {
                await this._graphProvider.executeWorkflow(new RevertWorkflow([commitHash]));
            }),

            vscode.commands.registerCommand("git-wiz.resetToCommit", async (commitHash: string) => {
                await this._graphProvider.executeWorkflow(new ResetWorkflow(commitHash));
            }),

            vscode.commands.registerCommand("git-wiz.checkoutBranch", async (item: string | { branchName: string; isRemote?: boolean }) => {
                const branchName = typeof item === "string" ? item : item.branchName;
                const isRemote = typeof item === "object" ? item.isRemote : branchName.includes("/");
                if (branchName) {
                    await this._graphProvider.executeWorkflow(new CheckoutBranchWorkflow(branchName, { track: isRemote }));
                }
            }),

            vscode.commands.registerCommand("git-wiz.checkoutRemoteBranch", async (item: string | { branchName: string }) => {
                const branchName = typeof item === "string" ? item : item.branchName;
                if (!branchName)
                    return;

                const parts = branchName.split("/");
                if (parts.length < 2)
                    return;

                const remote = parts[0];
                await this._graphProvider.executeWorkflow(new CheckoutBranchWorkflow(branchName, { remote }));
            }),

            vscode.commands.registerCommand("git-wiz.deleteBranch", async (branchTreeItem: { branchName: string }) => {
                const branchName = branchTreeItem.branchName;
                if (branchName) {
                    await this._graphProvider.executeWorkflow(new DeleteBranchWorkflow(branchName));
                }
            }),

            vscode.commands.registerCommand("git-wiz.deleteRemoteBranch", async (item: string | { branchName: string }) => {
                const fullName = typeof item === "string" ? item : item.branchName;
                if (fullName) {
                    await this._graphProvider.executeWorkflow(new DeleteRemoteBranchWorkflow(fullName));
                }
            }),

            vscode.commands.registerCommand("git-wiz.fetch", async () => {
                await this._graphProvider.executeWorkflow(new FetchWorkflow({ all: true }));
            }),

            vscode.commands.registerCommand("git-wiz.pull", async () => {
                await this._graphProvider.executeWorkflow(new PullWorkflow());
            }),

            vscode.commands.registerCommand("git-wiz.push", async () => {
                await this._graphProvider.executeWorkflow(new PushWorkflow());
            }),

            vscode.commands.registerCommand("git-wiz.pushForce", async () => {
                const btnPush = t(vscode.env.language, "pushForceConfirm");
                const btnCancel = t(vscode.env.language, "cancel");
                const confirm = await vscode.window.showWarningMessage(
                    t(vscode.env.language, "pushForceConfirm"),
                    btnPush,
                    btnCancel,
                );
                if (confirm === btnPush) {
                    await this._graphProvider.executeWorkflow(new PushWorkflow({ force: true }));
                }
            }),

            vscode.commands.registerCommand("git-wiz.rebaseBranch", async (branchTreeItem: { branchName: string }) => {
                const targetBranch = branchTreeItem.branchName;
                if (targetBranch) {
                    await this._graphProvider.executeWorkflow(new RebaseBranchWorkflow(targetBranch));
                }
            }),

            vscode.commands.registerCommand("git-wiz.mergeBranch", async (branchTreeItem: { branchName: string }) => {
                const sourceBranch = branchTreeItem.branchName;
                if (sourceBranch) {
                    await this._graphProvider.executeWorkflow(new MergeBranchWorkflow(sourceBranch));
                }
            }),

            vscode.commands.registerCommand("git-wiz.createBranchFromTag", async (tagName: string) => {
                await this._graphProvider.executeWorkflow(new CreateBranchWorkflow(tagName));
            }),

            vscode.commands.registerCommand("git-wiz.pushTag", async (tagName: string) => {
                await this._graphProvider.executeWorkflow(new PushTagWorkflow(tagName));
            }),

            vscode.commands.registerCommand("git-wiz.createBranch", async (branchTreeItem: { branchName: string }) => {
                const sourceBranch = branchTreeItem.branchName;
                if (sourceBranch) {
                    await this._graphProvider.executeWorkflow(new CreateBranchWorkflow(sourceBranch));
                }
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
                    this._graphProvider.setLoading(true);
                    try {
                        await this._graphProvider.executeWorkflow({
                            label: "delete tag",
                            run: async (ctx: any) => {
                                await ctx.git.deleteTag(tagName);
                                vscode.window.showInformationMessage(t(vscode.env.language, "tagDeleteSuccess", { name: tagName }));
                            },
                        } as any);
                        vscode.commands.executeCommand("git-wiz.refreshBranches");
                        this._graphProvider.refresh();
                    }
                    catch (err: any) {
                        vscode.window.showErrorMessage(err.message);
                    }
                    finally {
                        this._graphProvider.setLoading(false);
                    }
                }
            }),

            vscode.commands.registerCommand("git-wiz.deleteMultipleBranches", async (branchNames: string[]) => {
                if (!branchNames || branchNames.length === 0)
                    return;

                const label = branchNames.length === 1 ? `branch '${branchNames[0]}'` : `${branchNames.length} branches`;
                const confirm = await vscode.window.showWarningMessage(
                    `Delete ${label}?`,
                    { detail: branchNames.join(", ") },
                    "Yes",
                    "No",
                );
                if (confirm !== "Yes")
                    return;

                this._graphProvider.setLoading(true);
                try {
                    const deleted: string[] = [];
                    const notMerged: string[] = [];
                    const failed: { name: string; error: string }[] = [];

                    for (const name of branchNames) {
                        try {
                            await this._graphProvider.executeWorkflow({
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
                                    await this._graphProvider.executeWorkflow({
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

                    this._graphProvider.refresh();
                }
                finally {
                    this._graphProvider.setLoading(false);
                }
            }),
        );
    }
}
