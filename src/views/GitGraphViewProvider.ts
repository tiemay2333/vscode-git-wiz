import type { DataManagerRegistry } from "./dataManager/DataManagerRegistry";
import type { IViewDataManager } from "./dataManager/IViewDataManager";
import type { FromWebviewMessage, ToWebviewMessage } from "./types/WebviewProtocol";
import type { CommitUIStatus } from "./UIConverter";
import type { BaseWorkflow } from "@/git/workflow/base";
import * as vscode from "vscode";
import { GraphState } from "@/core/GraphState";
import { getCurrentBranchHashes } from "@/git/highlight/commitHighlight";
import { t } from "@/locale/i18n";
import { FileHandler, GitCommandHandler, SettingsHandler, UIStateHandler } from "./handlers";
import { RefreshManager } from "./RefreshManager";
import { UIConverter } from "./UIConverter";
import { getCommitDetailsHtml, getHtmlForWebview } from "./webviewContent";
import { WebviewMessenger } from "./WebviewMessenger";

const PAGE_SIZE = 200;

export class GitGraphViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    public static readonly viewType = "gitLeanGraphView";
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentProvider: GitGraphViewProvider | undefined;

    private _disposables: vscode.Disposable[] = [];
    private _dataManager: IViewDataManager;
    private _loadingCount = 0;
    private _messageQueue: Promise<void> = Promise.resolve();

    private readonly _messenger: WebviewMessenger;
    private readonly _refreshManager: RefreshManager;
    private _uiConverter: UIConverter;

    private _settingsScope: "local" | "global" = "global";
    private _gitCommandHandler!: GitCommandHandler;
    private _settingsHandler!: SettingsHandler;
    private readonly _uiStateHandler: UIStateHandler;
    private readonly _fileHandler: FileHandler;
    private readonly _state: GraphState;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        public cwd: string,
        private readonly _registry: DataManagerRegistry,
    ) {
        this._dataManager = this._registry.getManagerForPath(this.cwd);
        this._state = new GraphState();

        this._messenger = new WebviewMessenger();
        this._refreshManager = new RefreshManager(resetScroll => this._doRefresh(resetScroll));
        this._uiConverter = new UIConverter(this._dataManager.gitService);

        this._initHandlers();

        this._uiStateHandler = new UIStateHandler(
            this._state,
            reset => this.refresh(reset),
            webview => this.updateWebview(webview),
            webview => this.loadMoreCommits(webview),
            webview => this.requestUnfilteredCommits(webview),
        );
        this._fileHandler = new FileHandler();

        this.subscribeToEvents();
    }

    private _initHandlers() {
        this._gitCommandHandler?.dispose();
        this._gitCommandHandler = new GitCommandHandler(
            this._dataManager.workflowEngine,
            branch => this.filterByBranch(branch),
        );

        this._settingsHandler?.dispose();
        this._settingsHandler = new SettingsHandler(
            this._dataManager.gitService,
            () => this._dataManager.refs.getUniqueRemotes(),
            (scope) => { this._settingsScope = scope; },
            visible => this.setLoading(visible),
        );
    }

    private subscribeToEvents() {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];

        // Subscribe to global events
        this._disposables.push(this._dataManager.onDidRefresh((options) => {
            this._refreshManager.refresh(options);
        }));
        this._disposables.push(this._dataManager.onDidUpdateCommitHighlight((e: { hash: string; verificationStatus: string }) => {
            this._messenger.postMessage({ command: "updateCommitHighlight", hash: e.hash, verificationStatus: e.verificationStatus });
        }));
        this._disposables.push(this._dataManager.onDidUpdateLoading((visible) => {
            this._messenger.postMessage({ command: "setLoading", visible });
        }));
    }

    public updateCwd(newCwd: string) {
        if (this.cwd === newCwd)
            return;
        this.cwd = newCwd;
        this._dataManager = this._registry.getManagerForPath(this.cwd);
        this._uiConverter = new UIConverter(this._dataManager.gitService);

        this._initHandlers();
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

    public static createOrShow(extensionUri: vscode.Uri, cwd: string, registry: DataManagerRegistry) {
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

        const provider = new GitGraphViewProvider(extensionUri, cwd, registry);
        GitGraphViewProvider.currentProvider = provider;
        provider._messenger.setPanel(panel);
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
        this._messenger.setView(webviewView);

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible && this._refreshManager.isInitialized) {
                this.refresh();
            }
        });

        webviewView.onDidDispose(() => {
            this._refreshManager.setInitialized(false);
            this._state.resetFilters();
            this._uiConverter.resetCache();
        });

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.onDidReceiveMessage(message => this.handleMessage(message, webviewView.webview));

        this.updateWebview(webviewView.webview);
    }

    private async handleMessage(message: FromWebviewMessage, webview: vscode.Webview) {
        const cmd = message.command;

        // 立即处理同步状态，不入队
        if (cmd === "ready") {
            this._refreshManager.setInitialized(true);
            return;
        }

        // 使用队列序列化所有异步操作
        this._messageQueue = this._messageQueue.then(async () => {
            try {
                // Special case: reverify commit highlight
                if (cmd === "reverifyCommit") {
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
                    await this._gitCommandHandler.handle(message);
                    return;
                }
                // Settings & configuration — delegate to SettingsHandler
                if (cmd === "saveFilesViewMode" || cmd === "saveCommitDetailsViewMode"
                    || cmd === "settingsUpdateSetting" || cmd === "settingsSetGitConfig"
                    || cmd === "settingsGetGitConfig" || cmd === "settingsAddRemote"
                    || cmd === "settingsRemoveRemote" || cmd === "settingsFetchRemote") {
                    await this._settingsHandler.handle(message, webview);
                    return;
                }
                // File & diff operations
                if (cmd === "getCommitFiles") {
                    await this.getCommitFiles(message.commitHash, webview);
                    return;
                }
                if (cmd === "openDiff" || cmd === "openFile") {
                    this._fileHandler.handle(message);
                    return;
                }
                // UI state management — delegate to UIStateHandler
                await this._uiStateHandler.handle(message, webview);
            }
            catch (error) {
                console.error(`Error handling webview message ${cmd}:`, error);
            }
        });

        await this._messageQueue;
    }

    private async _reverifyCommit(commitHash: string): Promise<void> {
        const commits = await this._dataManager.history.getGitLog(null, 0, 1, { query: commitHash });
        if (commits.length === 0)
            return;

        const commit = commits[0];
        const currentBranch = await this._dataManager.refs.getCurrentBranch();
        if (!currentBranch)
            return;

        const branchHashes = await this._dataManager.history.getBranchCommits(currentBranch);

        await this._uiConverter.ensureSignaturesLoaded(currentBranch);

        const result = getCurrentBranchHashes([commit], branchHashes, this._uiConverter.signaturesCache!.signatures);
        if (result.pending.has(commit.hash)) {
            const targets = result.pending.get(commit.hash)!;
            this._dataManager.verifier.queueVerification(commit.hash, targets);
        }
    }

    private getConfig<T>(key: string, defaultValue: T): T {
        return vscode.workspace.getConfiguration("git-wiz").get<T>(key, defaultValue);
    }

    private async requestUnfilteredCommits(_webview: vscode.Webview) {
        const commits = await this._dataManager.history.getUnfilteredLog(this._state.filterBranch, 0, Math.max(PAGE_SIZE, this._state.loadedCount));
        const currentBranch = await this._dataManager.refs.getCurrentBranch();
        const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);

        let uiStatus: Record<string, CommitUIStatus> = {};
        if (highlightCurrentBranch && currentBranch) {
            uiStatus = await this._uiConverter.calculateUIStatus(commits, currentBranch);
        }

        this._state.loadedCount = commits.length;
        this._state.searchFilters = undefined;
        this._messenger.postMessage({
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
        const view = this._messenger.view;
        if (view) {
            view.title = title;
        }
    }

    public async refresh(resetScroll: boolean = false) {
        this._dataManager.refreshAll({ resetScroll });
    }

    private async _doRefresh(resetScroll: boolean) {
        this._uiConverter.resetCache();
        const countToLoad = Math.max(PAGE_SIZE, this._state.loadedCount);
        const commits = await this._dataManager.history.getGitLog(this._state.filterBranch, 0, countToLoad, this._state.searchFilters, this._state.filterFile);
        const currentBranch = await this._dataManager.refs.getCurrentBranch();
        const branches = await this._dataManager.refs.getBranches();
        const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);
        const showTags = this.getConfig("showTags", true);
        const showRemoteBranches = this.getConfig("showRemoteBranches", true);
        const showGraph = this.getConfig("showGraph", true);

        let uiStatus: Record<string, CommitUIStatus> = {};
        if (highlightCurrentBranch && currentBranch) {
            uiStatus = await this._uiConverter.calculateUIStatus(commits, currentBranch);
        }

        this.updateViewTitle(currentBranch);

        this._state.loadedCount = commits.length;
        const hasMore = commits.length >= countToLoad;
        const msg: ToWebviewMessage = {
            command: "replaceCommits",
            commits,
            uiStatus,
            hasMore,
            filterBranch: this._state.filterBranch,
            filterFile: this._state.filterFile,
            currentBranch,
            resetScroll,
            highlightCurrentBranch,
            showTags,
            showRemoteBranches,
            showGraph,
        };
        this._messenger.postMessage(msg);
        this._messenger.postMessage({ command: "replaceBranches", branches });
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
        const webview = this._messenger.webview;
        if (!webview)
            return;

        const userName = await this._dataManager.config.getGitConfig("user.name", this._settingsScope) || "";
        const userEmail = await this._dataManager.config.getGitConfig("user.email", this._settingsScope) || "";

        this._messenger.postMessage({
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
                remotes: await this._dataManager.refs.getUniqueRemotes(),
                locale: vscode.env.language,
            },
        });
    }

    private async updateWebview(webview: vscode.Webview) {
        if (this._refreshManager.isRefreshing) {
            this._refreshManager.refresh();
            return;
        }

        this._refreshManager.setInitialized(false);
        try {
            this._state.loadedCount = 0;
            const countToLoad = Math.max(PAGE_SIZE, this._state.loadedCount);
            const commits = await this._dataManager.history.getGitLog(this._state.filterBranch, 0, countToLoad, this._state.searchFilters, this._state.filterFile);
            const currentBranch = await this._dataManager.refs.getCurrentBranch();
            const branches = await this._dataManager.refs.getBranches();
            const filesViewMode = this.getConfig<"tree" | "list">("filesViewMode", "list");
            const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);
            const showTags = this.getConfig("showTags", true);
            const showRemoteBranches = this.getConfig("showRemoteBranches", true);
            const showGraph = this.getConfig("showGraph", true);
            const searchDefaultMode = this.getConfig("searchDefaultMode", "single");

            let uiStatus: Record<string, CommitUIStatus> = {};
            if (highlightCurrentBranch && currentBranch) {
                uiStatus = await this._uiConverter.calculateUIStatus(commits, currentBranch);
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
            // Note: RefreshManager will be set to initialized when the webview sends 'ready'
        }
    }

    private async loadMoreCommits(_webview: vscode.Webview) {
        const commits = await this._dataManager.history.getGitLog(
            this._state.filterBranch,
            this._state.loadedCount,
            PAGE_SIZE,
            this._state.searchFilters,
            this._state.filterFile,
        );
        const currentBranch = await this._dataManager.refs.getCurrentBranch();
        const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);
        const showTags = this.getConfig("showTags", true);
        const showRemoteBranches = this.getConfig("showRemoteBranches", true);
        const showGraph = this.getConfig("showGraph", true);

        let uiStatus: Record<string, CommitUIStatus> = {};
        if (highlightCurrentBranch && currentBranch) {
            uiStatus = await this._uiConverter.calculateUIStatus(commits, currentBranch);
        }

        this._state.loadedCount += commits.length;
        const hasMore = commits.length === PAGE_SIZE;
        this._messenger.postMessage({ command: "appendCommits", commits, uiStatus, hasMore, showTags, showRemoteBranches, showGraph });
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
            this._messenger.postMessage({ command: "setLoading", visible: this._loadingCount > 0 });
        }
    }

    private async getCommitFiles(commitHash: string, _webview: vscode.Webview) {
        const files = await this._dataManager.history.getGitLog(null, 0, 1, { query: commitHash });
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

            const panel = this._messenger.panel;
            if (panel) {
                const panelWebview = panel.webview;
                panelWebview.html = getCommitDetailsHtml(panelWebview, data, this._extensionUri, detailsMode, vscode.env.language);
            }
        }

        try {
            const filesData = await this._dataManager.files.getCommitFiles(commitHash);
            this._messenger.postMessage({ command: "commitFilesData", commitHash, files: filesData });
        }
        catch (e: any) {
            this._messenger.postMessage({
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
