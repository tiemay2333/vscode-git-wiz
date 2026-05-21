import type * as vscode from "vscode";
import type { GitService } from "@/git/core/GitService";
import type { AsyncHighlightVerifier } from "@/git/highlight/AsyncHighlightVerifier";
import type { GitWorkflowEngine } from "@/git/workflow/engine";

export interface IViewDataManager extends vscode.Disposable {
    readonly cwd: string;
    readonly gitService: GitService;
    readonly workflowEngine: GitWorkflowEngine;
    readonly verifier: AsyncHighlightVerifier;
    readonly onDidRefresh: vscode.Event<void>;
    readonly onDidUpdateCommitHighlight: vscode.Event<{ hash: string; verificationStatus: string }>;
    readonly onDidUpdateLoading: vscode.Event<boolean>;
    refreshAll: () => void;
}
