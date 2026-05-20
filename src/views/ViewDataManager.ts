import * as vscode from "vscode";
import { GitService } from "@/git/core/GitService";
import { AsyncHighlightVerifier } from "@/git/highlight/AsyncHighlightVerifier";
import { GitWorkflowEngine } from "@/git/workflow/engine";
import { VSCodeUIService } from "@/git/workflow/vscode-ui";

/**
 * ViewDataManager 负责集中管理特定 Git 仓库的资源、状态和监听器。
 * 多个实例通过静态缓存机制管理，以支持多仓库/多工作区环境。
 */
export class ViewDataManager implements vscode.Disposable {
    private static _instances = new Map<string, ViewDataManager>();

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

    private constructor(public readonly cwd: string) {
        this._gitService = new GitService({ cwd });

        // 每个仓库独立的 UI Service，用于处理进度条和通知
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
        try {
            const lockUri = vscode.Uri.file(this.cwd).with({ path: `${this.cwd}/.git/index.lock` });
            await vscode.workspace.fs.stat(lockUri);
            this._isLocked = true;
        }
        catch {
            this._isLocked = false;
        }
    }

    /**
     * 获取或创建指定路径的 ViewDataManager 实例
     */
    public static getManagerForPath(cwd: string): ViewDataManager {
        if (!this._instances.has(cwd)) {
            this._instances.set(cwd, new ViewDataManager(cwd));
        }
        return this._instances.get(cwd)!;
    }

    /**
     * 销毁并移除指定路径的 ViewDataManager 实例
     */
    public static disposeManagerForPath(cwd: string) {
        const manager = this._instances.get(cwd);
        if (manager) {
            manager.dispose();
            this._instances.delete(cwd);
        }
    }

    /**
     * 解析当前活动的 Git 仓库路径
     * 优先级: 活跃编辑器所在仓库 > 第一个工作区
     */
    public static getActiveManager(): ViewDataManager | undefined {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
            if (workspaceFolder) {
                return this.getManagerForPath(workspaceFolder.uri.fsPath);
            }
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return this.getManagerForPath(workspaceFolders[0].uri.fsPath);
        }

        return undefined;
    }

    public static setupWorkspaceWatcher() {
        vscode.workspace.onDidChangeWorkspaceFolders((e) => {
            for (const folder of e.removed) {
                this.disposeManagerForPath(folder.uri.fsPath);
            }
        });
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
    }
}
