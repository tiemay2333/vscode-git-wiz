import type { IViewDataManager, RefreshOptions, ViewDataSnapshot } from "./dataManager/IViewDataManager";
import type { SearchFilters } from "@/core/GraphStateSetting";
import type { GitService } from "@/git/core/GitService";
import type { AsyncHighlightVerifier } from "@/git/highlight/AsyncHighlightVerifier";
import type { GitWorkflowEngine } from "@/git/workflow/engine";
import * as vscode from "vscode";
import { GraphState } from "@/core/GraphStateSetting";
import { getCommitSignature } from "@/git/highlight/commitHighlight";
import { UIConverter } from "./UIConverter";

const PAGE_SIZE = 200;

/**
 * ViewDataManager 负责集中管理特定 Git 仓库的资源、状态和监听器。
 * 它是视图层的“状态引擎”，负责数据获取、分页、过滤和 UI 转换。
 */
export class ViewDataManager implements IViewDataManager {
    private readonly _onDidRefresh = new vscode.EventEmitter<RefreshOptions>();
    private readonly _onDidUpdateCommitHighlight = new vscode.EventEmitter<{ hash: string; verificationStatus: string }>();
    private readonly _onDidUpdateLoading = new vscode.EventEmitter<boolean>();
    private readonly _onDidUpdateSnapshot = new vscode.EventEmitter<ViewDataSnapshot>();

    private _watchers: vscode.Disposable[] = [];
    private _configWatcher: vscode.Disposable | undefined;
    private _refreshTimer?: ReturnType<typeof setTimeout>;
    private _isLocked = false;
    private _pendingRefresh = false;
    private _pendingResetScroll = false;

    // View State
    private readonly _state: GraphState;
    private readonly _uiConverter: UIConverter;
    private _isReady = false;
    private _isRefreshing = false;
    private _lastSnapshot?: ViewDataSnapshot;

    public readonly onDidRefresh = this._onDidRefresh.event;
    public readonly onDidUpdateCommitHighlight = this._onDidUpdateCommitHighlight.event;
    public readonly onDidUpdateLoading = this._onDidUpdateLoading.event;
    public readonly onDidUpdateSnapshot = this._onDidUpdateSnapshot.event;

    constructor(
        public readonly cwd: string,
        private readonly _gitService: GitService,
        private readonly _workflowEngine: GitWorkflowEngine,
        private readonly _verifier: AsyncHighlightVerifier,
    ) {
        this._state = new GraphState();
        this._uiConverter = new UIConverter(this._gitService);
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

    public get history() {
        return this._gitService.history;
    }

    public get refs() {
        return this._gitService.refs;
    }

    public get ops() {
        return this._gitService.ops;
    }

    public get files() {
        return this._gitService.files;
    }

    public get config() {
        return this._gitService.config;
    }

    public get workflowEngine(): GitWorkflowEngine {
        return this._workflowEngine;
    }

    public get verifier(): AsyncHighlightVerifier {
        return this._verifier;
    }

    public setReady(ready: boolean) {
        const wasReady = this._isReady;
        this._isReady = ready;
        if (!wasReady && ready && this._pendingRefresh) {
            this.refreshAll({ resetScroll: this._pendingResetScroll });
        }
    }

    public getSnapshot(): ViewDataSnapshot | undefined {
        return this._lastSnapshot;
    }

    public refreshAll(options: RefreshOptions = {}) {
        const resetScroll = !!options.resetScroll;
        this._pendingResetScroll = this._pendingResetScroll || resetScroll;

        if (this._isLocked) {
            this._pendingRefresh = true;
            return;
        }

        if (!this._isReady || this._isRefreshing) {
            this._pendingRefresh = true;
            return;
        }

        this._pendingRefresh = false;
        this._verifier.reset();

        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }

        this._refreshTimer = setTimeout(() => {
            const currentReset = this._pendingResetScroll;
            this._pendingResetScroll = false;
            this._doRefresh(currentReset);
        }, 500);
    }

    private async _doRefresh(resetScroll: boolean) {
        this._isRefreshing = true;
        this._onDidUpdateLoading.fire(true);

        try {
            this._uiConverter.resetCache();
            const countToLoad = Math.max(PAGE_SIZE, this._state.loadedCount);
            const commits = await this.history.getGitLog(
                this._state.filterBranch,
                0,
                countToLoad,
                this._state.searchFilters,
                this._state.filterFile,
            );
            const currentBranch = await this.refs.getCurrentBranch();
            const branches = await this.refs.getBranches();
            const highlightCurrentBranch = vscode.workspace.getConfiguration("git-wiz").get("highlightCurrentBranch", false);

            let uiStatus: Record<string, any> = {};
            if (highlightCurrentBranch && currentBranch) {
                uiStatus = await this._uiConverter.calculateUIStatus(commits, currentBranch);
                this._triggerAsyncVerification(uiStatus);
            }

            this._state.loadedCount = commits.length;
            const hasMore = commits.length >= countToLoad;

            const snapshot: ViewDataSnapshot = {
                commits,
                branches,
                uiStatus,
                hasMore,
                filterBranch: this._state.filterBranch,
                filterFile: this._state.filterFile,
                currentBranch,
                searchFilters: this._state.searchFilters,
                loadedCount: this._state.loadedCount,
                resetScroll,
            };

            this._lastSnapshot = snapshot;
            this._onDidUpdateSnapshot.fire(snapshot);
            this._onDidRefresh.fire({ resetScroll });
        }
        finally {
            this._isRefreshing = false;
            this._onDidUpdateLoading.fire(false);

            if (this._pendingRefresh) {
                this.refreshAll();
            }
        }
    }

    public async loadMoreCommits() {
        if (this._isRefreshing)
            return;

        this._isRefreshing = true;
        this._onDidUpdateLoading.fire(true);

        try {
            const commits = await this.history.getGitLog(
                this._state.filterBranch,
                this._state.loadedCount,
                PAGE_SIZE,
                this._state.searchFilters,
                this._state.filterFile,
            );

            const currentBranch = await this.refs.getCurrentBranch();
            const highlightCurrentBranch = vscode.workspace.getConfiguration("git-wiz").get("highlightCurrentBranch", false);

            let uiStatus: Record<string, any> = {};
            if (highlightCurrentBranch && currentBranch) {
                uiStatus = await this._uiConverter.calculateUIStatus(commits, currentBranch);
                this._triggerAsyncVerification(uiStatus);
            }

            this._state.loadedCount += commits.length;
            const hasMore = commits.length === PAGE_SIZE;

            const snapshot: ViewDataSnapshot = {
                commits,
                branches: [], // Incremental update doesn't usually need full branches
                uiStatus,
                hasMore,
                filterBranch: this._state.filterBranch,
                filterFile: this._state.filterFile,
                currentBranch,
                searchFilters: this._state.searchFilters,
                loadedCount: this._state.loadedCount,
                isIncremental: true,
            };

            this._onDidUpdateSnapshot.fire(snapshot);
        }
        finally {
            this._isRefreshing = false;
            this._onDidUpdateLoading.fire(false);
        }
    }

    public async reverifyCommit(hash: string) {
        const currentBranch = await this.refs.getCurrentBranch();
        if (!currentBranch)
            return;

        // 获取该提交的完整信息（需要 email 和 subject）
        const commits = await this.history.getGitLog(null, 0, 1, { query: hash });
        if (commits.length === 0)
            return;
        const commit = commits[0];

        await this._uiConverter.ensureSignaturesLoaded(currentBranch);
        const sig = getCommitSignature(commit);
        const targets = this._uiConverter.signaturesCache?.signatures.get(sig);

        if (targets) {
            this._verifier.queueVerification(hash, targets);
        }
    }

    public setFilterBranch(branch: string | null) {
        if (this._state.filterBranch === branch)
            return;
        this._state.filterBranch = branch;
        this.refreshAll({ resetScroll: true });
    }

    public setFilterFile(filePath: string | null) {
        if (this._state.filterFile === filePath)
            return;
        this._state.filterFile = filePath;
        this.refreshAll({ resetScroll: true });
    }

    public setSearchFilters(filters: SearchFilters | undefined) {
        this._state.searchFilters = filters;
        this.refreshAll({ resetScroll: true });
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

    private _triggerAsyncVerification(uiStatus: Record<string, any>) {
        for (const [hash, status] of Object.entries(uiStatus)) {
            if (status.verificationStatus === "pending" && status.pendingTargets) {
                this._verifier.queueVerification(hash, status.pendingTargets);
            }
        }
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
