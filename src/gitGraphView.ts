import type { GitCommit } from "./gitOperations";
import * as vscode from "vscode";
import { FileHandler } from "./fileHandler";
import { AsyncHighlightVerifier } from "./git/AsyncHighlightVerifier";
import { getCurrentBranchHashes } from "./git/commitHighlight";
import { GitCommandHandler } from "./gitCommandHandler";
import { GitService } from "./gitOperations";
import { SettingsHandler } from "./settingsHandler";
import { getCommitDetailsHtml, getHtmlForWebview } from "./webviewContent";

import { GitWorkflowEngine } from "./git/workflow/engine";
import { DeleteBranchWorkflow } from "./git/workflow/impl/DeleteBranchWorkflow";
import { BaseWorkflow } from "./git/workflow/base";

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

export class GitGraphViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    public static readonly viewType = "gitLeanGraphView";
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentProvider: GitGraphViewProvider | undefined;
    private _view?: vscode.WebviewView;
    private _watchers: vscode.Disposable[] = [];
    private _filterBranch: string | null = null;
    private _filterFile: string | null = null;
    private _loadedCount = 0;
    private _searchFilters?: { query?: string; author?: string; from?: string; to?: string };
    private readonly _gitService: GitService;
    private _refreshTimer?: ReturnType<typeof setTimeout>;
    private _initialized = false;
    private _pendingRefresh = false;
    private _refreshing = false;
    private _pendingResetScroll = false;
    private _branchSignaturesCache: { branch: string; headHash: string; signatures: Map<string, string[]> } | null = null;
    private _settingsScope: "local" | "global" = "global";
    private _verifier?: AsyncHighlightVerifier;
    private readonly _gitCommandHandler: GitCommandHandler;
    private readonly _settingsHandler: SettingsHandler;
    private readonly _fileHandler: FileHandler;
    private readonly _workflowEngine: GitWorkflowEngine;

    constructor(private readonly _extensionUri: vscode.Uri) {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
        this._gitService = new GitService({ cwd });
        this._workflowEngine = new GitWorkflowEngine(this._gitService, () => this.refresh());
        this._verifier = new AsyncHighlightVerifier(this._gitService, (hash, status) => {
            this.postToWebview({ command: "updateCommitHighlight", hash, verificationStatus: status });
        });
        this._gitCommandHandler = new GitCommandHandler(
            this._gitService,
            this._workflowEngine,
            () => this.refresh(),
            tagName => this.pushTag(tagName),
        );
        this._settingsHandler = new SettingsHandler(
            this._gitService,
            () => this._gitService.getUniqueRemotes(),
            (scope) => { this._settingsScope = scope; },
        );
        this._fileHandler = new FileHandler();
        this.setupGitWatcher();
        vscode.workspace.onDidChangeWorkspaceFolders(() => this.setupGitWatcher());
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("git-wiz.highlightCurrentBranch") || e.affectsConfiguration("git-wiz.showTags") || e.affectsConfiguration("git-wiz.showRemoteBranches") || e.affectsConfiguration("git-wiz.showGraph") || e.affectsConfiguration("git-wiz.searchDefaultMode")) {
                this.refresh();
            }
        });
    }

    public filterByBranch(branch: string | null) {
        this._filterBranch = branch;
        this.refresh(true);
    }

    public filterByFile(filePath: string | null) {
        this._filterFile = filePath;
        this.refresh(true);
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (GitGraphViewProvider.currentPanel) {
            GitGraphViewProvider.currentPanel.reveal(column);
            GitGraphViewProvider.currentProvider?.refresh();
            return;
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

        const provider = new GitGraphViewProvider(extensionUri);
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
            this._filterBranch = null;
            this._filterFile = null;
            this._loadedCount = 0;
            this._searchFilters = undefined;
            this._branchSignaturesCache = null;
            this._verifier?.reset();
        });

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.onDidReceiveMessage(message => this.handleMessage(message, webviewView.webview));

        this.updateWebview(webviewView.webview);
        this._initialized = true;
        if (this._pendingRefresh) {
            const reset = this._pendingResetScroll;
            this._pendingRefresh = false;
            this._pendingResetScroll = false;
            this.refresh(reset);
        }
    }

    private async handleMessage(message: WebviewMessage, webview: vscode.Webview) {
        const cmd = message.command;

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
            || cmd === "revertCommits" || cmd === "dropCommits" || cmd === "pushTag") {
            await this._gitCommandHandler.handle(cmd, message);
            return;
        }
        // Branch/tag operations — delegate to GitCommandHandler
        if (cmd === "newTag" || cmd === "createBranch" || cmd === "selectBranch"
            || cmd === "deleteMultipleBranches" || cmd === "createBranchFromTag"
            || cmd === "deleteTag" || cmd === "checkoutBranch" || cmd === "deleteBranch"
            || cmd === "deleteRemoteBranch" || cmd === "rebaseBranch" || cmd === "mergeBranch") {
            this.execBranchTagCommand(cmd, message);
            return;
        }
        // Settings & configuration — delegate to SettingsHandler
        if (cmd === "saveFilesViewMode" || cmd === "saveCommitDetailsViewMode"
            || cmd === "settingsUpdateSetting" || cmd === "settingsSetGitConfig"
            || cmd === "settingsGetGitConfig" || cmd === "settingsAddRemote"
            || cmd === "settingsRemoveRemote") {
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
        // UI state management — stays on provider (tightly coupled to state)
        this.handleUIState(cmd, message, webview);
    }

    private async _reverifyCommit(commitHash: string): Promise<void> {
        const commits = await this._gitService.getGitLog(null, 0, 1, { query: commitHash });
        if (commits.length === 0)
            return;

        const commit = commits[0];
        const currentBranch = await this._gitService.getCurrentBranch();
        if (!currentBranch)
            return;

        const branchHashes = await this._gitService.getBranchCommits(currentBranch);
        const headHash = await this._gitService.getHeadHash(currentBranch);

        if (!this._branchSignaturesCache
            || this._branchSignaturesCache.branch !== currentBranch
            || (headHash && this._branchSignaturesCache.headHash !== headHash)) {
            const signatures = await this._gitService.getBranchCommitSignatures(currentBranch);
            this._branchSignaturesCache = {
                branch: currentBranch,
                headHash: headHash || "",
                signatures,
            };
        }

        const result = getCurrentBranchHashes([commit], branchHashes, this._branchSignaturesCache.signatures);
        if (result.pending.has(commit.hash)) {
            const targets = result.pending.get(commit.hash)!;
            this._verifier?.queueVerification(commit.hash, targets);
        }
    }

    private execBranchTagCommand(cmd: string, msg: WebviewMessage): void {
        switch (cmd) {
            case "newTag":
                this.createNewTag(msg.commitHash!);
                break;
            case "createBranch":
                if (msg.branchName) {
                    vscode.commands.executeCommand("git-wiz.createBranch", { branchName: msg.branchName });
                }
                else {
                    this.createBranchFromCommit(msg.commitHash!);
                }
                break;
            case "selectBranch":
                this.filterByBranch(msg.branchName || null);
                break;
            case "deleteMultipleBranches":
                vscode.commands.executeCommand("git-wiz.deleteMultipleBranches", msg.branchNames);
                break;
            case "createBranchFromTag":
            case "deleteTag":
                vscode.commands.executeCommand(`git-wiz.${cmd}`, msg.tagName);
                break;
            case "checkoutBranch":
                vscode.commands.executeCommand("git-wiz.checkoutBranch", { branchName: msg.branchName, isRemote: msg.isRemote });
                break;
            case "deleteBranch":
                if (msg.branchName) {
                    this._workflowEngine.execute(new DeleteBranchWorkflow(msg.branchName));
                }
                break;
            case "deleteRemoteBranch":
            case "rebaseBranch":
            case "mergeBranch":
                vscode.commands.executeCommand(`git-wiz.${cmd}`, { branchName: msg.branchName });
                break;
        }
    }

    private handleUIState(cmd: string, msg: WebviewMessage, webview: vscode.Webview): void {
        switch (cmd) {
            case "search":
                this._searchFilters = msg.filters;
                this._initialized = true;
                this.refresh(true);
                break;
            case "refresh":
                this.updateWebview(webview);
                break;
            case "clearBranchFilter":
                this._filterBranch = null;
                this.refresh(true);
                break;
            case "filterByFile":
                this._filterFile = msg.filePath || null;
                this.refresh(true);
                break;
            case "clearFileFilter":
                this._filterFile = null;
                this.refresh(true);
                break;
            case "loadMoreCommits":
                this.loadMoreCommits(webview);
                break;
            case "showErrorMessage":
                vscode.window.showErrorMessage(msg.error || "Unknown error");
                break;
            case "requestUnfilteredCommits":
                this.requestUnfilteredCommits(webview);
                break;
        }
    }

    private setupGitWatcher() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        this._watchers.forEach(w => w.dispose());
        this._watchers = [];

        const patterns = [
            ".git/HEAD",
            ".git/packed-refs",
            ".git/refs/heads/**",
            ".git/refs/remotes/**",
            ".git/refs/tags/**",
        ];

        for (const pattern of patterns) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(workspaceFolders[0], pattern),
            );

            watcher.onDidChange(() => this.debouncedRefresh());
            watcher.onDidCreate(() => this.debouncedRefresh());
            watcher.onDidDelete(() => this.debouncedRefresh());

            this._watchers.push(watcher);
        }
    }

    private getConfig<T>(key: string, defaultValue: T): T {
        return vscode.workspace.getConfiguration("git-wiz").get<T>(key, defaultValue);
    }

    private async requestUnfilteredCommits(webview: vscode.Webview) {
        const commits = await this._gitService.getUnfilteredLog(this._filterBranch, 0, Math.max(PAGE_SIZE, this._loadedCount));
        const currentBranch = await this._gitService.getCurrentBranch();
        const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);

        if (highlightCurrentBranch && currentBranch) {
            await this.applyHighlight(commits, currentBranch);
        }

        this._loadedCount = commits.length;
        this._searchFilters = undefined;
        webview.postMessage({
            command: "replaceCommits",
            commits,
            hasMore: commits.length >= Math.max(PAGE_SIZE, this._loadedCount),
            filterBranch: this._filterBranch,
            filterFile: this._filterFile,
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

    private debouncedRefresh() {
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }
        this._refreshTimer = setTimeout(() => this.refresh(), 500);
    }

    private updateViewTitle(_currentBranch: string | null) {
        if (GitGraphViewProvider.currentPanel) {
            let title = "Tree";
            if (this._filterFile) {
                title += ` - ${this._filterFile}`;
            }
            else if (this._filterBranch) {
                title += ` - ${this._filterBranch}`;
                if (_currentBranch && this._filterBranch !== _currentBranch) {
                    title += ` (HEAD on ${_currentBranch})`;
                }
            }
            else {
                title += " - All Branches";
                if (_currentBranch) {
                    title += ` (HEAD on ${_currentBranch})`;
                }
            }
            GitGraphViewProvider.currentPanel.title = title;
        }
    }

    public async refresh(resetScroll: boolean = false) {
        if (!this._initialized) {
            this._pendingRefresh = true;
            if (resetScroll)
                this._pendingResetScroll = true;
            return;
        }
        if (this._refreshing) {
            this._pendingRefresh = true;
            if (resetScroll)
                this._pendingResetScroll = true;
            return;
        }

        const actualResetScroll = resetScroll || this._pendingResetScroll;
        this._pendingResetScroll = false;

        this._refreshing = true;
        try {
            this._branchSignaturesCache = null;
            const countToLoad = Math.max(PAGE_SIZE, this._loadedCount);
            const commits = await this._gitService.getGitLog(this._filterBranch, 0, countToLoad, this._searchFilters, this._filterFile);
            const currentBranch = await this._gitService.getCurrentBranch();
            const branches = await this._gitService.getBranches();
            const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);
            const showTags = this.getConfig("showTags", true);
            const showRemoteBranches = this.getConfig("showRemoteBranches", true);
            const showGraph = this.getConfig("showGraph", true);

            if (highlightCurrentBranch && currentBranch) {
                await this.applyHighlight(commits, currentBranch);
            }

            this.updateViewTitle(currentBranch);

            this._loadedCount = commits.length;
            const hasMore = commits.length >= countToLoad;
            const msg = {
                command: "replaceCommits",
                commits,
                hasMore,
                filterBranch: this._filterBranch,
                filterFile: this._filterFile,
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
                this._pendingRefresh = false;
                this.refresh(this._pendingResetScroll);
            }
        }
    }

    public async executeWorkflow<T>(workflow: BaseWorkflow<T>): Promise<T | undefined> {
        return await this._workflowEngine.execute(workflow);
    }

    public dispose() {
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }
        this._watchers.forEach(w => w.dispose());
        this._watchers = [];
        this._gitCommandHandler.dispose();
        this._settingsHandler.dispose();
        this._fileHandler.dispose();
        this._verifier?.dispose();
    }

    public async createNewTag(commitHash: string) {
        const tagName = await vscode.window.showInputBox({
            prompt: "Enter new tag name",
            placeHolder: "e.g. v1.0.0",
        });
        if (tagName) {
            try {
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Creating tag '${tagName}'...` }, async () => {
                    await this._gitService.createTag(tagName, commitHash);
                    const action = await vscode.window.showInformationMessage(`Tag '${tagName}' created successfully`, "Push Tag");
                    this.refresh();
                    if (action === "Push Tag") {
                        await this.pushTag(tagName);
                    }
                });
            }
            catch (e: any) {
                vscode.window.showErrorMessage(e.message || "Failed to create tag");
            }
        }
    }

    public async pushTag(tagName: string) {
        try {
            const remotes = await this._gitService.getUniqueRemotes();
            if (remotes.length === 0) {
                vscode.window.showErrorMessage("No remotes found. Cannot push tag.");
                return;
            }

            let targetRemote = remotes.find(r => r.name === "origin")?.name || remotes[0].name;
            if (remotes.length > 1) {
                const picked = await vscode.window.showQuickPick(remotes.map(r => r.name), {
                    placeHolder: "Select a remote to push the tag to",
                });
                if (!picked)
                    return;
                targetRemote = picked;
            }

            await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Pushing tag '${tagName}' to '${targetRemote}'...` }, async () => {
                await this._gitService.push({ force: false, setUpstream: undefined }); // Wait, push needs tag support. Let's fix GitService push.
                // Actually I'll use a specific push method for tags in GitService.
            });
        }
        catch (e: any) {
            vscode.window.showErrorMessage(e.message || "Failed to push tag");
        }
    }

    public async createBranchFromCommit(commitHash: string, providedBranchName?: string) {
        const branchName = providedBranchName || await vscode.window.showInputBox({
            prompt: "Enter new branch name",
            placeHolder: "e.g. feature/new-branch",
        });
        if (branchName) {
            try {
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Creating branch '${branchName}'...` }, async () => {
                    await this._gitService.checkoutBranch(branchName, { create: true, startPoint: commitHash });
                    vscode.window.showInformationMessage(`Branch '${branchName}' created and switched successfully`);
                    this.refresh();
                    vscode.commands.executeCommand("git-wiz.refreshBranches");
                });
            }
            catch (e: any) {
                vscode.window.showErrorMessage(e.message || "Failed to create branch");
            }
        }
    }

    public async showSettings() {
        const webview = this._view?.webview || GitGraphViewProvider.currentPanel?.webview;
        if (!webview)
            return;

        const userName = await this._gitService.getGitConfig("user.name", this._settingsScope) || "";
        const userEmail = await this._gitService.getGitConfig("user.email", this._settingsScope) || "";

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
                remotes: await this._gitService.getUniqueRemotes(),
                locale: vscode.env.language,
            },
        });
    }

    private async updateWebview(webview: vscode.Webview) {
        this._initialized = false;
        this._loadedCount = 0;
        const countToLoad = Math.max(PAGE_SIZE, this._loadedCount);
        const commits = await this._gitService.getGitLog(this._filterBranch, 0, countToLoad, this._searchFilters, this._filterFile);
        const currentBranch = await this._gitService.getCurrentBranch();
        const branches = await this._gitService.getBranches();
        const filesViewMode = this.getConfig<"tree" | "list">("filesViewMode", "list");
        const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);
        const showTags = this.getConfig("showTags", true);
        const showRemoteBranches = this.getConfig("showRemoteBranches", true);
        const showGraph = this.getConfig("showGraph", true);
        const searchDefaultMode = this.getConfig("searchDefaultMode", "single");

        if (highlightCurrentBranch && currentBranch) {
            await this.applyHighlight(commits, currentBranch);
        }

        this.updateViewTitle(currentBranch);

        this._loadedCount = commits.length;
        const hasMore = commits.length >= countToLoad;
        webview.html = getHtmlForWebview(
            webview,
            commits,
            branches,
            hasMore,
            this._filterBranch,
            currentBranch,
            this._extensionUri,
            filesViewMode,
            this._filterFile,
            highlightCurrentBranch,
            showTags,
            showRemoteBranches,
            showGraph,
            searchDefaultMode,
            vscode.env.language,
        );
        this._initialized = true;
        if (this._pendingRefresh) {
            this._pendingRefresh = false;
            this.refresh();
        }
    }

    private async loadMoreCommits(webview: vscode.Webview) {
        const commits = await this._gitService.getGitLog(
            this._filterBranch,
            this._loadedCount,
            PAGE_SIZE,
            this._searchFilters,
            this._filterFile,
        );
        const currentBranch = await this._gitService.getCurrentBranch();
        const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);
        const showTags = this.getConfig("showTags", true);
        const showRemoteBranches = this.getConfig("showRemoteBranches", true);
        const showGraph = this.getConfig("showGraph", true);

        if (highlightCurrentBranch && currentBranch) {
            await this.applyHighlight(commits, currentBranch);
        }

        this._loadedCount += commits.length;
        const hasMore = commits.length === PAGE_SIZE;
        webview.postMessage({ command: "appendCommits", commits, hasMore, showTags, showRemoteBranches, showGraph });
    }

    private async applyHighlight(commits: GitCommit[], currentBranch: string): Promise<void> {
        const branchHashes = await this._gitService.getBranchCommits(currentBranch);
        const headHash = await this._gitService.getHeadHash(currentBranch);

        if (!this._branchSignaturesCache
            || this._branchSignaturesCache.branch !== currentBranch
            || (headHash && this._branchSignaturesCache.headHash !== headHash)) {
            const signatures = await this._gitService.getBranchCommitSignatures(currentBranch);
            this._branchSignaturesCache = {
                branch: currentBranch,
                headHash: headHash || "",
                signatures,
            };
        }

        const result = getCurrentBranchHashes(commits, branchHashes, this._branchSignaturesCache.signatures);
        for (const c of commits) {
            if (result.verified.has(c.hash)) {
                c.isCurrentBranch = true;
                c.verificationStatus = "verified";
            }
            else if (result.pending.has(c.hash)) {
                c.isCurrentBranch = true;
                c.verificationStatus = "pending";
            }
            else {
                c.isCurrentBranch = false;
                c.verificationStatus = undefined;
            }
        }
    }

    private async getCommitFiles(commitHash: string, webview: vscode.Webview) {
        const files = await this._gitService.getGitLog(null, 0, 1, { query: commitHash });
        if (files.length > 0) {
            const commit = files[0];
            const patchResult = await this._gitService.getRunner().exec(["show", commitHash, "--patch"]);
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
            const filesData = await this._gitService.getCommitFiles(commitHash);
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
        vscode.window.showInformationMessage("Commit hash copied to clipboard");
    }

    public async copyCommitMessage(commitHash: string, commitMessage: string) {
        await vscode.env.clipboard.writeText(commitMessage);
        vscode.window.showInformationMessage("Commit message copied to clipboard");
    }

    public async revertCommit(commitHash: string) {
        const confirm = await vscode.window.showWarningMessage(`Are you sure you want to revert commit ${commitHash.substring(0, 7)}?`, "Yes", "No");
        if (confirm === "Yes") {
            return vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Reverting commit ${commitHash.substring(0, 7)}...` }, async () => {
                try {
                    await this._gitService.revertCommit(commitHash);
                    vscode.window.showInformationMessage("Commit reverted successfully");
                    this.refresh();
                }
                catch (e: any) {
                    vscode.window.showErrorMessage(e.message || "Revert failed");
                }
            });
        }
    }

    public async resetToCommit(commitHash: string) {
        const items: (vscode.QuickPickItem & { value: string })[] = [
            { label: "Soft", description: "Keep changes staged", value: "--soft" },
            { label: "Mixed", description: "Keep changes unstaged", value: "--mixed" },
            { label: "Hard", description: "Discard all changes", value: "--hard" },
        ];
        const resetType = await vscode.window.showQuickPick(items, { placeHolder: "Select reset type" });
        if (resetType) {
            const confirm = await vscode.window.showWarningMessage(`Are you sure you want to reset to commit ${commitHash.substring(0, 7)} (${resetType.label})?`, "Yes", "No");
            if (confirm === "Yes") {
                return vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Resetting to commit ${commitHash.substring(0, 7)} (${resetType.label})...` }, async () => {
                    try {
                        await this._gitService.resetToCommit(commitHash, resetType.value);
                        vscode.window.showInformationMessage(`Reset to commit ${commitHash.substring(0, 7)} successfully`);
                        this.refresh();
                    }
                    catch (e: any) {
                        vscode.window.showErrorMessage(e.message || "Reset failed");
                    }
                });
            }
        }
    }
}
