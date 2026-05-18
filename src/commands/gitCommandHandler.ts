import type { WebviewMessage } from "@/views/gitGraphView";
import type { GitService } from "@/git/core/gitOperations";
import * as vscode from "vscode";
import { GitWorkflowEngine } from "@/git/workflow/engine";
import { t } from "@/locale/i18n";
import { CherryPickWorkflow } from "@/git/workflow/impl/CherryPickWorkflow";
import { RevertWorkflow } from "@/git/workflow/impl/RevertWorkflow";
import { ResetWorkflow } from "@/git/workflow/impl/ResetWorkflow";
import { DropWorkflow } from "@/git/workflow/impl/DropWorkflow";
import { SquashWorkflow } from "@/git/workflow/impl/SquashWorkflow";
import { PushTagWorkflow } from "@/git/workflow/impl/PushTagWorkflow";
import { DeleteBranchWorkflow } from "@/git/workflow/impl/DeleteBranchWorkflow";
import { CreateTagWorkflow } from "@/git/workflow/impl/CreateTagWorkflow";
import { CreateBranchWorkflow } from "@/git/workflow/impl/CreateBranchWorkflow";

export class GitCommandHandler implements vscode.Disposable {
    constructor(
        private readonly _gitService: GitService,
        private readonly _workflowEngine: GitWorkflowEngine,
        private readonly _refresh: () => void,
        private readonly _filterByBranch: (branch: string | null) => void,
    ) { }

    dispose(): void {
        // No resources to manage
    }

    async handle(cmd: string, msg: WebviewMessage): Promise<void> {
        try {
            switch (cmd) {
                case "cherryPick":
                    await this._workflowEngine.execute(new CherryPickWorkflow([msg.commitHash!]));
                    break;
                case "copyHash":
                    await vscode.env.clipboard.writeText(msg.commitHash!);
                    vscode.window.showInformationMessage(t(vscode.env.language, "copyHashSuccess"));
                    break;
                case "copyCommitMessage":
                    await vscode.env.clipboard.writeText(msg.commitMessage!);
                    vscode.window.showInformationMessage(t(vscode.env.language, "copyMessageSuccess"));
                    break;
                case "revertCommit":
                    await this._workflowEngine.execute(new RevertWorkflow([msg.commitHash!]));
                    break;
                case "resetToCommit":
                    await this._workflowEngine.execute(new ResetWorkflow(msg.commitHash!));
                    break;
                case "dropCommit":
                    await this._workflowEngine.execute(new DropWorkflow([msg.commitHash!], msg.parentHash!));
                    break;
                case "squashCommits":
                    await this._workflowEngine.execute(new SquashWorkflow(msg.hashes!, msg.parentHash!));
                    break;
                case "cherryPickRange":
                    await this._workflowEngine.execute(new CherryPickWorkflow(msg.hashes!));
                    break;
                case "revertCommits":
                    await this._workflowEngine.execute(new RevertWorkflow(msg.hashes!));
                    break;
                case "dropCommits":
                    await this._workflowEngine.execute(new DropWorkflow(msg.hashes!, msg.parentHash!));
                    break;
                case "pushTag":
                    await this._workflowEngine.execute(new PushTagWorkflow(msg.tagName!));
                    break;
                case "newTag":
                    await this._workflowEngine.execute(new CreateTagWorkflow(msg.commitHash!));
                    break;
                case "createBranch":
                    if (msg.branchName) {
                        vscode.commands.executeCommand("git-wiz.createBranch", { branchName: msg.branchName });
                    }
                    else {
                        await this._workflowEngine.execute(new CreateBranchWorkflow(msg.commitHash!));
                    }
                    break;
                case "selectBranch":
                    this._filterByBranch(msg.branchName || null);
                    break;
                case "deleteMultipleBranches":
                    vscode.commands.executeCommand("git-wiz.deleteMultipleBranches", msg.branchNames);
                    break;
                case "createBranchFromTag":
                case "deleteTag":
                    vscode.commands.executeCommand(`git-wiz.${cmd}`, msg.tagName);
                    break;
                case "checkoutBranch":
                    vscode.commands.executeCommand("git-wiz.checkoutBranch", { branchName: msg.branchName, isRemote: msg.isRemote });
                    break;
                case "deleteBranch":
                    if (msg.branchName) {
                        await this._workflowEngine.execute(new DeleteBranchWorkflow(msg.branchName));
                    }
                    break;
                case "deleteRemoteBranch":
                case "rebaseBranch":
                case "mergeBranch":
                    vscode.commands.executeCommand(`git-wiz.${cmd}`, { branchName: msg.branchName });
                    break;
            }
        }
        catch (e: any) {
            vscode.window.showErrorMessage(e.message || "Operation failed");
        }
    }
}
