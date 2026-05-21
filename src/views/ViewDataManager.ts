import type { IViewDataManager } from "./dataManager/IViewDataManager";
import type { GitService } from "@/git/core/GitService";
import type { AsyncHighlightVerifier } from "@/git/highlight/AsyncHighlightVerifier";
import type { GitWorkflowEngine } from "@/git/workflow/engine";
import * as vscode from "vscode";

/**
 * ViewDataManager 负责集中管理特定 Git 仓库的资源、状态和监听器。
 */
export class ViewDataManager implements IViewDataManager {
    private readonly _onDidRefresh = new vscode.EventEmitter<void>();
    private readonly _onDidUpdateCommitHighlight = new vscode.EventEmitter<{ hash: string; verificationStatus: string }>();
    private readonly _onDidUpdateLoading = new vscode.EventEmitter<boolean>();
    private _watchers: vscode.Disposable[] = [];
    private _configWatcher: vscode.Disposable | undefined;
    private _refreshTimer?: ReturnType<typeof setTimeout>;
    private _isLocked = false;
    private _pendingRefresh = false;

    public readonly onDidRefresh = this._onDidRefresh.event;
    public readonly onDidUpdateCommitHighlight = this._onDidUpdateCommitHighlight.event;
    public readonly onDidUpdateLoading = this._onDidUpdateLoading.event;

    constructor(
        public readonly cwd: string,
        private readonly _gitService: GitService,
        private readonly _workflowEngine: GitWorkflowEngine,
        private readonly _verifier: AsyncHighlightVerifier,
    ) {
        this.init();
    }

    private async init() {
        await this.checkInitialLockState();
        this.setupGitWatcher();
        this.setupConfigWatcher();
    }

    private async checkInitialLockState() {
        try {
            const lockUri = vscode.Uri.file(this.cwd).with({ path: `${this.cwd}/.git/index.lock` });
            await vscode.workspace.fs.stat(lockUri);
            this._isLocked = true;
        }
        catch {
            this._isLocked = false;
        }
    }

    public get gitService(): GitService {
        return this._gitService;
    }

    public get workflowEngine(): GitWorkflowEngine {
        return this._workflowEngine;
    }

    public get verifier(): AsyncHighlightVerifier {
        return this._verifier;
    }

    public refreshAll() {
        if (this._isLocked) {
            this._pendingRefresh = true;
            return;
        }
        this._pendingRefresh = false;
        this._verifier.reset();
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }
        this._refreshTimer = setTimeout(() => {
            this._onDidRefresh.fire();
        }, 500);
    }

    private setupGitWatcher() {
        this._watchers.forEach(w => w.dispose());
        this._watchers = [];

        // 查找当前实例对应的 WorkspaceFolder
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(this.cwd));
        if (!workspaceFolder)
            return;

        const patterns = [
            ".git/HEAD",
            ".git/packed-refs",
            ".git/index.lock",
            ".git/MERGE_HEAD",
            ".git/CHERRY_PICK_HEAD",
            ".git/REVERT_HEAD",
            ".git/rebase-merge/**",
            ".git/rebase-apply/**",
            ".git/refs/heads/**",
            ".git/refs/remotes/**",
            ".git/refs/tags/**",
        ];

        for (const pattern of patterns) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(workspaceFolder, pattern),
            );

            if (pattern === ".git/index.lock") {
                watcher.onDidCreate(() => {
                    this._isLocked = true;
                });
                watcher.onDidDelete(() => {
                    this._isLocked = false;
                    if (this._pendingRefresh) {
                        this.refreshAll();
                    }
                });
            }
            else {
                watcher.onDidChange(() => this.refreshAll());
                watcher.onDidCreate(() => this.refreshAll());
                watcher.onDidDelete(() => this.refreshAll());
            }

            this._watchers.push(watcher);
        }
    }

    private setupConfigWatcher() {
        this._configWatcher?.dispose();
        this._configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("git-wiz")) {
                this.refreshAll();
            }
        });
    }

    public dispose() {
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }
        this._watchers.forEach(w => w.dispose());
        this._configWatcher?.dispose();
        this._verifier.dispose();
        this._onDidRefresh.dispose();
        this._onDidUpdateCommitHighlight.dispose();
        this._onDidUpdateLoading.dispose();
    }
}
