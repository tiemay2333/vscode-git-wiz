import type { WebviewMessage } from "./gitGraphView";
import type { GitService } from "./gitOperations";
import * as vscode from "vscode";
import { GitWorkflowEngine } from "./git/workflow/engine";
import { t } from "./i18n";
import { CherryPickWorkflow } from "./git/workflow/impl/CherryPickWorkflow";
import { RevertWorkflow } from "./git/workflow/impl/RevertWorkflow";
import { ResetWorkflow } from "./git/workflow/impl/ResetWorkflow";
import { DropWorkflow } from "./git/workflow/impl/DropWorkflow";
import { SquashWorkflow } from "./git/workflow/impl/SquashWorkflow";
import { PushTagWorkflow } from "./git/workflow/impl/PushTagWorkflow";

export class GitCommandHandler implements vscode.Disposable {
    constructor(
        private readonly _gitService: GitService,
        private readonly _workflowEngine: GitWorkflowEngine,
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
            }
        }
        catch (e: any) {
            vscode.window.showErrorMessage(e.message || "Operation failed");
        }
    }
}
