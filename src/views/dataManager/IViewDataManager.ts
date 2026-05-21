import type * as vscode from "vscode";
import type { GitService } from "@/git/core/GitService";
import type { AsyncHighlightVerifier } from "@/git/highlight/AsyncHighlightVerifier";
import type { GitWorkflowEngine } from "@/git/workflow/engine";

export interface RefreshOptions {
    resetScroll?: boolean;
}

export interface IViewDataManager extends vscode.Disposable {
    readonly cwd: string;
    readonly gitService: GitService;
    readonly history: GitService["history"];
    readonly refs: GitService["refs"];
    readonly ops: GitService["ops"];
    readonly files: GitService["files"];
    readonly config: GitService["config"];
    readonly workflowEngine: GitWorkflowEngine;
    readonly verifier: AsyncHighlightVerifier;
    readonly onDidRefresh: vscode.Event<RefreshOptions>;
    readonly onDidUpdateCommitHighlight: vscode.Event<{ hash: string; verificationStatus: string }>;
    readonly onDidUpdateLoading: vscode.Event<boolean>;
    refreshAll: (options?: RefreshOptions) => void;
}
