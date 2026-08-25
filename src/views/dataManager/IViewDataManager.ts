import type * as vscode from "vscode";
import type { CommitUIStatus } from "../UIConverter";
import type { SearchFilters } from "@/core/GraphState";
import type { Branch, GitCommit, GitService } from "@/git/core/GitService";
import type { AsyncHighlightVerifier } from "@/git/highlight/AsyncHighlightVerifier";
import type { GitWorkflowEngine } from "@/git/workflow/engine";

export interface RefreshOptions {
    resetScroll?: boolean;
}

export interface ViewDataSnapshot {
    commits: GitCommit[];
    branches: Branch[];
    uiStatus: Record<string, CommitUIStatus>;
    hasMore: boolean;
    filterBranch: string | null;
    filterFile: string | null;
    currentBranch: string | null;
    searchFilters?: SearchFilters;
    loadedCount: number;
    resetScroll?: boolean;
    isIncremental?: boolean; // If true, commits should be appended rather than replaced
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
    readonly onDidUpdateSnapshot: vscode.Event<ViewDataSnapshot>;

    refreshAll: (options?: RefreshOptions) => void;
    loadMoreCommits: () => Promise<void>;
    reverifyCommit: (hash: string) => Promise<void>;
    setFilterBranch: (branch: string | null) => void;
    setFilterFile: (filePath: string | null) => void;
    setSearchFilters: (filters: SearchFilters | undefined) => void;
    setReady: (ready: boolean) => void;
    getSnapshot: () => ViewDataSnapshot | undefined;
}
