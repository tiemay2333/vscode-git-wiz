import * as vscode from "vscode";
import { GitService } from "@/git/core/GitService";
import { AsyncHighlightVerifier } from "@/git/highlight/AsyncHighlightVerifier";
import { GitWorkflowEngine } from "@/git/workflow/engine";
import { VSCodeUIService } from "@/git/workflow/vscode-ui";

/**
 * ViewDataManager 是一个全局单例，负责集中管理 Git 资源、状态和监听器。
 * 它确保了侧边栏和主面板视图共享同一个 GitService、锁定机制和文件监听器。
 */
export class ViewDataManager implements vscode.Disposable {
    private static _instance: ViewDataManager | undefined;
    private readonly _gitService: GitService;
    private readonly _workflowEngine: GitWorkflowEngine;
    private readonly _verifier: AsyncHighlightVerifier;
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

    private constructor() {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
        this._gitService = new GitService({ cwd });

        // 全局共享的 UI Service，用于处理进度条和通知
        const uiService = new VSCodeUIService((visible) => {
            this._onDidUpdateLoading.fire(visible);
        });

        this._workflowEngine = new GitWorkflowEngine(this._gitService, () => this.refreshAll(), uiService);

        this._verifier = new AsyncHighlightVerifier(this._gitService, (hash, status) => {
            this._onDidUpdateCommitHighlight.fire({ hash, verificationStatus: status });
        });

        this.init();
    }

    private async init() {
        await this.checkInitialLockState();
        this.setupGitWatcher();
        this.setupConfigWatcher();
    }

    private async checkInitialLockState() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders)
            return;
        try {
            const lockUri = vscode.Uri.joinPath(workspaceFolders[0].uri, ".git/index.lock");
            await vscode.workspace.fs.stat(lockUri);
            this._isLocked = true;
        }
        catch {
            this._isLocked = false;
        }
    }

    public static getInstance(): ViewDataManager {
        if (!ViewDataManager._instance) {
            ViewDataManager._instance = new ViewDataManager();
        }
        return ViewDataManager._instance;
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
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders)
            return;

        this._watchers.forEach(w => w.dispose());
        this._watchers = [];

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
                new vscode.RelativePattern(workspaceFolders[0], pattern),
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
        ViewDataManager._instance = undefined;
    }
}
