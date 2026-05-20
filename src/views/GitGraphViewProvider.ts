import type { GitCommit } from "@/git/core/GitService";
import type { BaseWorkflow } from "@/git/workflow/base";
import * as vscode from "vscode";
import { GitCommandHandler } from "@/commands/gitCommandHandler";
import { FileHandler } from "@/core/fileHandler";
import { GraphState } from "@/core/graphState";
import { SettingsHandler } from "@/core/settingsHandler";
import { UIStateHandler } from "@/core/uiStateHandler";
import { getCurrentBranchHashes } from "@/git/highlight/commitHighlight";

import { t } from "@/locale/i18n";
import { ViewDataManager } from "./ViewDataManager";
import { getCommitDetailsHtml, getHtmlForWebview } from "./webviewContent";

const PAGE_SIZE = 200;

export interface WebviewMessage {
    command: string;
    commitHash?: string;
    commitMessage?: string;
    newMessage?: string;
    hashes?: string[];
    parentHash?: string;
    filePath?: string;
    filters?: { query?: string; author?: string; from?: string; to?: string };
    branchName?: string;
    branchNames?: string[];
    tagName?: string;
    isRemote?: boolean;
    mode?: "list" | "tree";
    error?: string;
    key?: string;
    value?: unknown;
    scope?: "local" | "global";
    remoteName?: string;
}

export interface CommitUIStatus {
    isCurrentBranch?: boolean;
    verificationStatus?: "pending" | "verified" | "failed";
}

export class GitGraphViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    public static readonly viewType = "gitLeanGraphView";
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentProvider: GitGraphViewProvider | undefined;
    private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];
    private _dataManager: ViewDataManager;
    private _initialized = false;
    private _loadingCount = 0;
    private _pendingRefresh = false;
    private _refreshing = false;
    private _pendingResetScroll = false;
    private _messageQueue: Promise<void> = Promise.resolve();
    private _signaturesLoadingPromise: Promise<void> | null = null;
    private _branchSignaturesCache: { branch: string; headHash: string; signatures: Map<string, string[]> } | null = null;
    private _settingsScope: "local" | "global" = "global";
    private _gitCommandHandler: GitCommandHandler;
    private _settingsHandler: SettingsHandler;
    private readonly _uiStateHandler: UIStateHandler;
    private readonly _fileHandler: FileHandler;
    private readonly _state: GraphState;

    constructor(private readonly _extensionUri: vscode.Uri, public cwd: string) {
        this._dataManager = ViewDataManager.getManagerForPath(this.cwd);
        this._state = new GraphState();

        this._gitCommandHandler = new GitCommandHandler(
            this._dataManager.workflowEngine,
            branch => this.filterByBranch(branch),
        );
        this._uiStateHandler = new UIStateHandler(
            this._state,
            reset => this.refresh(reset),
            webview => this.updateWebview(webview),
            webview => this.loadMoreCommits(webview),
            webview => this.requestUnfilteredCommits(webview),
        );
        this._settingsHandler = new SettingsHandler(
            this._dataManager.gitService,
            () => this._dataManager.gitService.getUniqueRemotes(),
            (scope) => { this._settingsScope = scope; },
            visible => this.setLoading(visible),
        );
        this._fileHandler = new FileHandler();

        this.subscribeToEvents();
    }

    private subscribeToEvents() {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];

        // Subscribe to global events
        this._disposables.push(this._dataManager.onDidRefresh(() => this.refresh()));
        this._disposables.push(this._dataManager.onDidUpdateCommitHighlight((e: { hash: string; verificationStatus: string }) => {
            this.postToWebview({ command: "updateCommitHighlight", hash: e.hash, verificationStatus: e.verificationStatus });
        }));
        this._disposables.push(this._dataManager.onDidUpdateLoading((visible) => {
            this.postToWebview({ command: "setLoading", visible });
        }));
    }

    public updateCwd(newCwd: string) {
        if (this.cwd === newCwd)
            return;
        this.cwd = newCwd;
        this._dataManager = ViewDataManager.getManagerForPath(this.cwd);

        // Update handlers with new data manager references
        this._gitCommandHandler?.dispose();
        this._gitCommandHandler = new GitCommandHandler(
            this._dataManager.workflowEngine,
            branch => this.filterByBranch(branch),
        );
        this._settingsHandler?.dispose();
        this._settingsHandler = new SettingsHandler(
            this._dataManager.gitService,
            () => this._dataManager.gitService.getUniqueRemotes(),
            (scope) => { this._settingsScope = scope; },
            visible => this.setLoading(visible),
        );

        this.subscribeToEvents();
        this._state.resetFilters();
        this.refresh(true);
    }

    public filterByBranch(branch: string | null) {
        this._state.filterBranch = branch;
        this.refresh(true);
    }

    public filterByFile(filePath: string | null) {
        this._state.filterFile = filePath;
        this.refresh(true);
    }

    public static createOrShow(extensionUri: vscode.Uri, cwd: string) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (GitGraphViewProvider.currentPanel) {
            GitGraphViewProvider.currentPanel.reveal(column);
            if (GitGraphViewProvider.currentProvider && GitGraphViewProvider.currentProvider.cwd === cwd) {
                GitGraphViewProvider.currentProvider?.refresh();
                return;
            }
            else {
                GitGraphViewProvider.currentPanel.dispose(); // Re-create for new cwd
            }
        }

        const panel = vscode.window.createWebviewPanel(
            GitGraphViewProvider.viewType,
            "Tree",
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri],
            },
        );

        GitGraphViewProvider.currentPanel = panel;

        const provider = new GitGraphViewProvider(extensionUri, cwd);
        GitGraphViewProvider.currentProvider = provider;
        provider.updateWebview(panel.webview);

        panel.onDidDispose(() => {
            GitGraphViewProvider.currentPanel = undefined;
            GitGraphViewProvider.currentProvider = undefined;
        });

        panel.webview.onDidReceiveMessage(message => provider.handleMessage(message, panel.webview));
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible && this._initialized) {
                this.refresh();
            }
        });

        webviewView.onDidDispose(() => {
            this._view = undefined;
            this._initialized = false;
            this._state.resetFilters();
            this._branchSignaturesCache = null;
        });

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.onDidReceiveMessage(message => this.handleMessage(message, webviewView.webview));

        this.updateWebview(webviewView.webview);
    }

    private async handleMessage(message: WebviewMessage, webview: vscode.Webview) {
        const cmd = message.command;

        // 立即处理同步状态，不入队
        if (cmd === "ready") {
            this._initialized = true;
            if (this._pendingRefresh) {
                const reset = this._pendingResetScroll;
                this._pendingRefresh = false;
                this._pendingResetScroll = false;
                this.refresh(reset);
            }
            return;
        }

        // 使用队列序列化所有异步操作
        this._messageQueue = this._messageQueue.then(async () => {
            try {
                // Special case: reverify commit highlight
                if (cmd === "reverifyCommit" && message.commitHash) {
                    await this._reverifyCommit(message.commitHash);
                    return;
                }

                // Git operations — delegate to GitCommandHandler
                if (cmd === "cherryPick"
                    || cmd === "copyHash" || cmd === "copyCommitMessage"
                    || cmd === "revertCommit" || cmd === "resetToCommit"
                    || cmd === "dropCommit" || cmd === "squashCommits" || cmd === "cherryPickRange"
                    || cmd === "revertCommits" || cmd === "dropCommits" || cmd === "pushTag"
                    || cmd === "newTag" || cmd === "createBranch" || cmd === "selectBranch"
                    || cmd === "deleteMultipleBranches" || cmd === "createBranchFromTag"
                    || cmd === "deleteTag" || cmd === "checkoutBranch" || cmd === "deleteBranch"
                    || cmd === "deleteRemoteBranch" || cmd === "rebaseBranch" || cmd === "mergeBranch") {
                    await this._gitCommandHandler.handle(cmd, message);
                    return;
                }
                // Settings & configuration — delegate to SettingsHandler
                if (cmd === "saveFilesViewMode" || cmd === "saveCommitDetailsViewMode"
                    || cmd === "settingsUpdateSetting" || cmd === "settingsSetGitConfig"
                    || cmd === "settingsGetGitConfig" || cmd === "settingsAddRemote"
                    || cmd === "settingsRemoveRemote" || cmd === "settingsFetchRemote") {
                    await this._settingsHandler.handle(cmd, message, webview);
                    return;
                }
                // File & diff operations
                if (cmd === "getCommitFiles") {
                    await this.getCommitFiles(message.commitHash!, webview);
                    return;
                }
                if (cmd === "openDiff" || cmd === "openFile") {
                    this._fileHandler.handle(cmd, message);
                    return;
                }
                // UI state management — delegate to UIStateHandler
                await this._uiStateHandler.handle(cmd, message, webview);
            }
            catch (error) {
                console.error(`Error handling webview message ${cmd}:`, error);
            }
        });

        await this._messageQueue;
    }

    private async _reverifyCommit(commitHash: string): Promise<void> {
        const commits = await this._dataManager.gitService.getGitLog(null, 0, 1, { query: commitHash });
        if (commits.length === 0)
            return;

        const commit = commits[0];
        const currentBranch = await this._dataManager.gitService.getCurrentBranch();
        if (!currentBranch)
            return;

        const branchHashes = await this._dataManager.gitService.getBranchCommits(currentBranch);

        await this.ensureSignaturesLoaded(currentBranch);

        const result = getCurrentBranchHashes([commit], branchHashes, this._branchSignaturesCache!.signatures);
        if (result.pending.has(commit.hash)) {
            const targets = result.pending.get(commit.hash)!;
            this._dataManager.verifier.queueVerification(commit.hash, targets);
        }
    }

    private getConfig<T>(key: string, defaultValue: T): T {
        return vscode.workspace.getConfiguration("git-wiz").get<T>(key, defaultValue);
    }

    private async requestUnfilteredCommits(webview: vscode.Webview) {
        const commits = await this._dataManager.gitService.getUnfilteredLog(this._state.filterBranch, 0, Math.max(PAGE_SIZE, this._state.loadedCount));
        const currentBranch = await this._dataManager.gitService.getCurrentBranch();
        const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);

        let uiStatus: Record<string, CommitUIStatus> = {};
        if (highlightCurrentBranch && currentBranch) {
            uiStatus = await this.calculateUIStatus(commits, currentBranch);
        }

        this._state.loadedCount = commits.length;
        this._state.searchFilters = undefined;
        webview.postMessage({
            command: "replaceCommits",
            commits,
            uiStatus,
            hasMore: commits.length >= Math.max(PAGE_SIZE, this._state.loadedCount),
            filterBranch: this._state.filterBranch,
            filterFile: this._state.filterFile,
            currentBranch,
            resetScroll: true,
            highlightCurrentBranch,
            showTags: this.getConfig("showTags", true),
            showRemoteBranches: this.getConfig("showRemoteBranches", true),
            showGraph: this.getConfig("showGraph", true),
        });
    }

    private postToWebview(msg: any): void {
        this._view?.webview.postMessage(msg);
        GitGraphViewProvider.currentPanel?.webview.postMessage(msg);
    }

    private updateViewTitle(_currentBranch: string | null) {
        let title = "Tree";
        if (this._state.filterFile) {
            title += ` - ${this._state.filterFile}`;
        }
        else if (this._state.filterBranch) {
            title += ` - ${this._state.filterBranch}`;
            if (_currentBranch && this._state.filterBranch !== _currentBranch) {
                title += ` (HEAD on ${_currentBranch})`;
            }
        }
        else {
            title += " - All Branches";
            if (_currentBranch) {
                title += ` (HEAD on ${_currentBranch})`;
            }
        }

        if (GitGraphViewProvider.currentPanel) {
            GitGraphViewProvider.currentPanel.title = title;
        }
        if (this._view) {
            this._view.title = title;
        }
    }

    public async refresh(resetScroll: boolean = false) {
        if (!this._initialized) {
            this._pendingRefresh = true;
            this._pendingResetScroll = this._pendingResetScroll || resetScroll;
            return;
        }
        if (this._refreshing) {
            this._pendingRefresh = true;
            this._pendingResetScroll = this._pendingResetScroll || resetScroll;
            return;
        }

        const actualResetScroll = resetScroll || this._pendingResetScroll;
        this._pendingResetScroll = false;

        this._refreshing = true;
        try {
            this._branchSignaturesCache = null;
            this._signaturesLoadingPromise = null;
            const countToLoad = Math.max(PAGE_SIZE, this._state.loadedCount);
            const commits = await this._dataManager.gitService.getGitLog(this._state.filterBranch, 0, countToLoad, this._state.searchFilters, this._state.filterFile);
            const currentBranch = await this._dataManager.gitService.getCurrentBranch();
            const branches = await this._dataManager.gitService.getBranches();
            const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);
            const showTags = this.getConfig("showTags", true);
            const showRemoteBranches = this.getConfig("showRemoteBranches", true);
            const showGraph = this.getConfig("showGraph", true);

            let uiStatus: Record<string, CommitUIStatus> = {};
            if (highlightCurrentBranch && currentBranch) {
                uiStatus = await this.calculateUIStatus(commits, currentBranch);
            }

            this.updateViewTitle(currentBranch);

            this._state.loadedCount = commits.length;
            const hasMore = commits.length >= countToLoad;
            const msg = {
                command: "replaceCommits",
                commits,
                uiStatus,
                hasMore,
                filterBranch: this._state.filterBranch,
                filterFile: this._state.filterFile,
                currentBranch,
                resetScroll: actualResetScroll,
                highlightCurrentBranch,
                showTags,
                showRemoteBranches,
                showGraph,
            };
            this.postToWebview(msg);
            this.postToWebview({ command: "replaceBranches", branches });
        }
        finally {
            this._refreshing = false;
            if (this._pendingRefresh) {
                const reset = this._pendingResetScroll;
                this._pendingRefresh = false;
                this._pendingResetScroll = false;
                this.refresh(reset);
            }
        }
    }

    public async executeWorkflow<T>(workflow: BaseWorkflow<T>): Promise<T | undefined> {
        return await this._dataManager.workflowEngine.execute(workflow);
    }

    public dispose() {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
        this._gitCommandHandler.dispose();
        this._settingsHandler.dispose();
        this._uiStateHandler.dispose();
        this._fileHandler.dispose();
    }

    public async showSettings() {
        const webview = this._view?.webview || GitGraphViewProvider.currentPanel?.webview;
        if (!webview)
            return;

        const userName = await this._dataManager.gitService.getGitConfig("user.name", this._settingsScope) || "";
        const userEmail = await this._dataManager.gitService.getGitConfig("user.email", this._settingsScope) || "";

        webview.postMessage({
            command: "showSettingsModal",
            data: {
                highlightCurrentBranch: this.getConfig("highlightCurrentBranch", false),
                showTags: this.getConfig("showTags", true),
                showRemoteBranches: this.getConfig("showRemoteBranches", true),
                showGraph: this.getConfig("showGraph", true),
                searchDefaultMode: this.getConfig("searchDefaultMode", "single"),
                userName,
                userEmail,
                scope: this._settingsScope,
                remotes: await this._dataManager.gitService.getUniqueRemotes(),
                locale: vscode.env.language,
            },
        });
    }

    private async updateWebview(webview: vscode.Webview) {
        if (this._refreshing) {
            this._pendingRefresh = true;
            return;
        }

        this._refreshing = true;
        this._initialized = false;
        try {
            this._state.loadedCount = 0;
            const countToLoad = Math.max(PAGE_SIZE, this._state.loadedCount);
            const commits = await this._dataManager.gitService.getGitLog(this._state.filterBranch, 0, countToLoad, this._state.searchFilters, this._state.filterFile);
            const currentBranch = await this._dataManager.gitService.getCurrentBranch();
            const branches = await this._dataManager.gitService.getBranches();
            const filesViewMode = this.getConfig<"tree" | "list">("filesViewMode", "list");
            const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);
            const showTags = this.getConfig("showTags", true);
            const showRemoteBranches = this.getConfig("showRemoteBranches", true);
            const showGraph = this.getConfig("showGraph", true);
            const searchDefaultMode = this.getConfig("searchDefaultMode", "single");

            let uiStatus: Record<string, CommitUIStatus> = {};
            if (highlightCurrentBranch && currentBranch) {
                uiStatus = await this.calculateUIStatus(commits, currentBranch);
            }

            this.updateViewTitle(currentBranch);

            this._state.loadedCount = commits.length;
            const hasMore = commits.length >= countToLoad;
            webview.html = getHtmlForWebview(
                webview,
                commits,
                branches,
                hasMore,
                this._state.filterBranch,
                currentBranch,
                this._extensionUri,
                filesViewMode,
                this._state.filterFile,
                highlightCurrentBranch,
                showTags,
                showRemoteBranches,
                showGraph,
                searchDefaultMode,
                vscode.env.language,
                uiStatus,
            );
        }
        finally {
            this._refreshing = false;
            // Note: _initialized will be set to true when the webview sends 'ready'
            if (this._pendingRefresh) {
                this._pendingRefresh = false;
                this.refresh(this._pendingResetScroll);
            }
        }
    }

    private async loadMoreCommits(webview: vscode.Webview) {
        const commits = await this._dataManager.gitService.getGitLog(
            this._state.filterBranch,
            this._state.loadedCount,
            PAGE_SIZE,
            this._state.searchFilters,
            this._state.filterFile,
        );
        const currentBranch = await this._dataManager.gitService.getCurrentBranch();
        const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);
        const showTags = this.getConfig("showTags", true);
        const showRemoteBranches = this.getConfig("showRemoteBranches", true);
        const showGraph = this.getConfig("showGraph", true);

        let uiStatus: Record<string, CommitUIStatus> = {};
        if (highlightCurrentBranch && currentBranch) {
            uiStatus = await this.calculateUIStatus(commits, currentBranch);
        }

        this._state.loadedCount += commits.length;
        const hasMore = commits.length === PAGE_SIZE;
        webview.postMessage({ command: "appendCommits", commits, uiStatus, hasMore, showTags, showRemoteBranches, showGraph });
    }

    private async ensureSignaturesLoaded(currentBranch: string): Promise<void> {
        while (true) {
            const headHash = await this._dataManager.gitService.getHeadHash(currentBranch);
            if (this._branchSignaturesCache
                && this._branchSignaturesCache.branch === currentBranch
                && (!headHash || this._branchSignaturesCache.headHash === headHash)) {
                break;
            }

            if (!this._signaturesLoadingPromise) {
                this._signaturesLoadingPromise = (async () => {
                    try {
                        const signatures = await this._dataManager.gitService.getBranchCommitSignatures(currentBranch);
                        this._branchSignaturesCache = {
                            branch: currentBranch,
                            headHash: headHash || "",
                            signatures,
                        };
                    }
                    finally {
                        this._signaturesLoadingPromise = null;
                    }
                })();
            }
            await this._signaturesLoadingPromise;
        }
    }

    private async calculateUIStatus(commits: GitCommit[], currentBranch: string): Promise<Record<string, CommitUIStatus>> {
        const branchHashes = await this._dataManager.gitService.getBranchCommits(currentBranch);

        await this.ensureSignaturesLoaded(currentBranch);

        if (!this._branchSignaturesCache) {
            return {};
        }

        const result = getCurrentBranchHashes(commits, branchHashes, this._branchSignaturesCache.signatures);
        const uiStatus: Record<string, CommitUIStatus> = {};

        for (const c of commits) {
            if (result.verified.has(c.hash)) {
                uiStatus[c.hash] = { isCurrentBranch: true, verificationStatus: "verified" };
            }
            else if (result.pending.has(c.hash)) {
                uiStatus[c.hash] = { isCurrentBranch: true, verificationStatus: "pending" };
            }
            else {
                uiStatus[c.hash] = { isCurrentBranch: false };
            }
        }

        return uiStatus;
    }

    public setLoading(visible: boolean) {
        const oldCount = this._loadingCount;
        if (visible) {
            this._loadingCount++;
        }
        else {
            this._loadingCount = Math.max(0, this._loadingCount - 1);
        }

        if ((oldCount === 0 && this._loadingCount > 0) || (oldCount > 0 && this._loadingCount === 0)) {
            this.postToWebview({ command: "setLoading", visible: this._loadingCount > 0 });
        }
    }

    private async getCommitFiles(commitHash: string, webview: vscode.Webview) {
        const files = await this._dataManager.gitService.getGitLog(null, 0, 1, { query: commitHash });
        if (files.length > 0) {
            const commit = files[0];
            const patchResult = await this._dataManager.gitService.getRunner().exec(["show", commitHash, "--patch"]);
            const patch = patchResult.exitCode === 0 ? patchResult.stdout : "";

            const data = {
                fullHash: commit.hash,
                authorEmail: commit.email,
                authorName: commit.author,
                authorDate: commit.date,
                commitDate: commit.date,
                subject: commit.message,
                body: "",
                patch,
            };

            const detailsMode = this.getConfig<"tree" | "list">("commitDetailsViewMode", "list");

            if (GitGraphViewProvider.currentPanel) {
                const panelWebview = GitGraphViewProvider.currentPanel.webview;
                panelWebview.html = getCommitDetailsHtml(panelWebview, data, this._extensionUri, detailsMode, vscode.env.language);
            }
        }

        try {
            const filesData = await this._dataManager.gitService.getCommitFiles(commitHash);
            webview.postMessage({ command: "commitFilesData", commitHash, files: filesData });
        }
        catch (e: any) {
            webview.postMessage({
                command: "commitFilesData",
                commitHash,
                error: e.message || "Failed to load commit files",
            });
        }
    }

    // Delegated public methods for extension.ts commands
    public async copyCommitHash(commitHash: string) {
        await vscode.env.clipboard.writeText(commitHash);
        vscode.window.showInformationMessage(t(vscode.env.language, "copyHashSuccess"));
    }

    public async copyCommitMessage(commitHash: string, commitMessage: string) {
        await vscode.env.clipboard.writeText(commitMessage);
        vscode.window.showInformationMessage(t(vscode.env.language, "copyMessageSuccess"));
    }
}
