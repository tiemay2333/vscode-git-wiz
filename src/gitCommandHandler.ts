import type { WebviewMessage } from "./gitGraphView";
import type { GitService } from "./gitOperations";
import * as vscode from "vscode";

export class GitCommandHandler implements vscode.Disposable {
    constructor(
        private readonly _gitService: GitService,
        private readonly _refresh: () => void,
        private readonly _pushTag: (tagName: string) => Promise<void>,
    ) { }

    dispose(): void {
        // No resources to manage
    }

    async handle(cmd: string, msg: WebviewMessage): Promise<void> {
        try {
            switch (cmd) {
                case "cherryPick":
                    await this._cherryPick(msg.commitHash!);
                    break;
                case "copyHash":
                    await vscode.env.clipboard.writeText(msg.commitHash!);
                    vscode.window.showInformationMessage("Commit hash copied to clipboard");
                    break;
                case "copyCommitMessage":
                    await vscode.env.clipboard.writeText(msg.commitMessage!);
                    vscode.window.showInformationMessage("Commit message copied to clipboard");
                    break;
                case "revertCommit":
                    await this._revertCommit(msg.commitHash!);
                    break;
                case "resetToCommit":
                    await this._resetToCommit(msg.commitHash!);
                    break;
                case "dropCommit":
                    await this._dropCommit(msg.commitHash!);
                    break;
                case "squashCommits":
                    await this._squashCommits(msg.hashes!, msg.parentHash!);
                    break;
                case "cherryPickRange":
                    await this._cherryPickRange(msg.hashes!);
                    break;
                case "revertCommits":
                    await this._revertCommits(msg.hashes!);
                    break;
                case "dropCommits":
                    await this._dropCommits(msg.hashes!, msg.parentHash!);
                    break;
                case "pushTag":
                    await this._pushTag(msg.tagName!);
                    break;
            }
        }
        catch (e: any) {
            vscode.window.showErrorMessage(e.message || "Operation failed");
        }
    }

    private async _cherryPick(commitHash: string): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: `Cherry-picking commit ${commitHash.substring(0, 7)}...`,
        }, async () => {
            await this._gitService.cherryPickCommit(commitHash);
            vscode.window.showInformationMessage("Commit cherry-picked successfully");
            this._refresh();
        });
    }

    private async _revertCommit(commitHash: string): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to revert commit ${commitHash.substring(0, 7)}?`,
            "Yes",
            "No",
        );
        if (confirm === "Yes") {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: `Reverting commit ${commitHash.substring(0, 7)}...`,
            }, async () => {
                await this._gitService.revertCommit(commitHash);
                vscode.window.showInformationMessage("Commit reverted successfully");
                this._refresh();
            });
        }
    }

    private async _resetToCommit(commitHash: string): Promise<void> {
        const items: (vscode.QuickPickItem & { value: string })[] = [
            { label: "Soft", description: "Keep changes staged", value: "--soft" },
            { label: "Mixed", description: "Keep changes unstaged", value: "--mixed" },
            { label: "Hard", description: "Discard all changes", value: "--hard" },
        ];
        const resetType = await vscode.window.showQuickPick(items, { placeHolder: "Select reset type" });
        if (resetType) {
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to reset to commit ${commitHash.substring(0, 7)} (${resetType.label})?`,
                "Yes",
                "No",
            );
            if (confirm === "Yes") {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Window,
                    title: `Resetting to commit ${commitHash.substring(0, 7)} (${resetType.label})...`,
                }, async () => {
                    await this._gitService.resetToCommit(commitHash, resetType.value);
                    vscode.window.showInformationMessage(`Reset to commit ${commitHash.substring(0, 7)} successfully`);
                    this._refresh();
                });
            }
        }
    }

    private async _dropCommit(commitHash: string): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to permanently drop commit ${commitHash.substring(0, 7)}? This cannot be undone.`,
            "Drop",
            "Cancel",
        );
        if (confirm === "Drop") {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: `Dropping commit ${commitHash.substring(0, 7)}...`,
            }, async () => {
                await this._gitService.dropCommit(commitHash);
                vscode.window.showInformationMessage("Commit dropped successfully");
                this._refresh();
            });
        }
    }

    private async _squashCommits(hashes: string[], parentHash: string): Promise<void> {
        const newMessage = await vscode.window.showInputBox({
            prompt: `Squash ${hashes.length} commits into one`,
            placeHolder: "New commit message",
            validateInput: v => (!v || !v.trim() ? "Message cannot be empty" : null),
        });
        if (!newMessage)
            return;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: `Squashing ${hashes.length} commits...`,
        }, async () => {
            await this._gitService.squashCommits(hashes, parentHash, newMessage);
            vscode.window.showInformationMessage(`Squashed ${hashes.length} commits successfully`);
            this._refresh();
        });
    }

    private async _cherryPickRange(hashes: string[]): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: `Cherry-picking ${hashes.length} commits...`,
        }, async () => {
            await this._gitService.cherryPickRange(hashes);
            vscode.window.showInformationMessage(`Cherry-picked ${hashes.length} commits successfully`);
            this._refresh();
        });
    }

    private async _revertCommits(hashes: string[]): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to revert ${hashes.length} commits? This will create ${hashes.length} new revert commits.`,
            "Yes",
            "No",
        );
        if (confirm === "Yes") {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: `Reverting ${hashes.length} commits...`,
            }, async () => {
                await this._gitService.revertCommits(hashes);
                vscode.window.showInformationMessage(`Reverted ${hashes.length} commits successfully`);
                this._refresh();
            });
        }
    }

    private async _dropCommits(hashes: string[], parentHash: string): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to permanently drop ${hashes.length} commits? This cannot be undone.`,
            "Drop",
            "Cancel",
        );
        if (confirm === "Drop") {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: `Dropping ${hashes.length} commits...`,
            }, async () => {
                await this._gitService.dropCommits(hashes, parentHash);
                vscode.window.showInformationMessage(`Dropped ${hashes.length} commits successfully`);
                this._refresh();
            });
        }
    }
}
