import type { GitCommit } from "./gitOperations";
import * as cp from "node:child_process";
import * as vscode from "vscode";
import { getCurrentBranchHashes } from "./git/commitHighlight";
import { GitOperations } from "./gitOperations";
import { getCommitDetailsHtml, getHtmlForWebview } from "./webviewContent";

const PAGE_SIZE = 200;

interface WebviewMessage {
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

export class GitGraphViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "gitLeanGraphView";
    private static currentPanel: vscode.WebviewPanel | undefined;
    private _view?: vscode.WebviewView;
    private _watcher?: vscode.FileSystemWatcher;
    private _filterBranch: string | null = null;
    private _filterFile: string | null = null;
    private _loadedCount = 0;
    private _searchFilters?: { query?: string; author?: string; from?: string; to?: string };
    private readonly _gitOps: GitOperations;
    private _refreshTimer?: ReturnType<typeof setTimeout>;
    private _initialized = false;
    private _pendingRefresh = false;
    private _branchSignaturesCache: { branch: string; signatures: Set<string> } | null = null;
    private _settingsScope: "local" | "global" = "global";

    constructor(private readonly _extensionUri: vscode.Uri) {
        this._gitOps = new GitOperations(() => this.refresh());
        this.setupGitWatcher();
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("git-wiz.highlightCurrentBranch") || e.affectsConfiguration("git-wiz.showTags") || e.affectsConfiguration("git-wiz.showRemoteBranches") || e.affectsConfiguration("git-wiz.showGraph")) {
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
        provider.updateWebview(panel.webview);

        panel.onDidDispose(() => {
            GitGraphViewProvider.currentPanel = undefined;
        });

        panel.webview.onDidReceiveMessage(message => provider.handleMessage(message, panel.webview));
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.onDidDispose(() => {
            this._view = undefined;
            this._initialized = false;
            this._filterBranch = null;
            this._filterFile = null;
        });

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.onDidReceiveMessage(message => this.handleMessage(message, webviewView.webview));

        this.updateWebview(webviewView.webview);
        this._initialized = true;
        if (this._pendingRefresh) {
            this._pendingRefresh = false;
            this.refresh();
        }
    }

    private async handleMessage(message: WebviewMessage, webview: vscode.Webview) {
        const cmd = message.command;
        // git operations — direct delegation to _gitOps
        if (cmd === "amendCommit" || cmd === "cherryPick"
            || cmd === "copyHash" || cmd === "copyCommitMessage"
            || cmd === "revertCommit" || cmd === "resetToCommit"
            || cmd === "dropCommit" || cmd === "squashCommits" || cmd === "cherryPickRange"
            || cmd === "revertCommits" || cmd === "dropCommits" || cmd === "pushTag") {
            await this.execGitOperation(cmd, message);
            return;
        }
        // branch/tag operations — forward to VS Code commands or UI prompts
        if (cmd === "newTag" || cmd === "createBranch" || cmd === "selectBranch"
            || cmd === "deleteMultipleBranches" || cmd === "createBranchFromTag"
            || cmd === "deleteTag" || cmd === "checkoutBranch" || cmd === "deleteBranch"
            || cmd === "deleteRemoteBranch" || cmd === "rebaseBranch" || cmd === "mergeBranch") {
            this.execBranchTagCommand(cmd, message);
            return;
        }
        // settings & configuration
        if (cmd === "saveFilesViewMode" || cmd === "saveCommitDetailsViewMode"
            || cmd === "settingsUpdateSetting" || cmd === "settingsSetGitConfig"
            || cmd === "settingsGetGitConfig" || cmd === "settingsAddRemote"
            || cmd === "settingsRemoveRemote") {
            await this.execSettingsCommand(cmd, message, webview);
            return;
        }
        // file & diff operations
        if (cmd === "getCommitFiles" || cmd === "openDiff" || cmd === "openFile") {
            this.execFileCommand(cmd, message, webview);
            return;
        }
        // UI state management — search, filters, view state
        this.handleUIState(cmd, message, webview);
    }

    private async execGitOperation(cmd: string, msg: WebviewMessage): Promise<void> {
        switch (cmd) {
            case "amendCommit":
                this._gitOps.amendCommit();
                break;
            case "cherryPick":
                this._gitOps.cherryPickCommit(msg.commitHash!);
                break;
            case "copyHash":
                this._gitOps.copyCommitHash(msg.commitHash!);
                break;
            case "copyCommitMessage":
                this._gitOps.copyCommitMessage(msg.commitHash!, msg.commitMessage!);
                break;
            case "revertCommit":
                this._gitOps.revertCommit(msg.commitHash!);
                break;
            case "resetToCommit":
                this._gitOps.resetToCommit(msg.commitHash!);
                break;
            case "dropCommit":
                this._gitOps.dropCommit(msg.commitHash!);
                break;
            case "squashCommits":
                this._gitOps.squashCommits(msg.hashes!, msg.parentHash!);
                break;
            case "cherryPickRange":
                this._gitOps.cherryPickRange(msg.hashes!);
                break;
            case "revertCommits":
                this._gitOps.revertCommits(msg.hashes!);
                break;
            case "dropCommits":
                this._gitOps.dropCommits(msg.hashes!, msg.parentHash!);
                break;
            case "pushTag":
                this._gitOps.pushTag(msg.tagName!);
                break;
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
            case "deleteRemoteBranch":
            case "rebaseBranch":
            case "mergeBranch":
                vscode.commands.executeCommand(`git-wiz.${cmd}`, { branchName: msg.branchName });
                break;
        }
    }

    private async execSettingsCommand(cmd: string, msg: WebviewMessage, webview: vscode.Webview): Promise<void> {
        switch (cmd) {
            case "saveFilesViewMode":
                vscode.workspace.getConfiguration("git-wiz").update("filesViewMode", msg.mode, vscode.ConfigurationTarget.Global);
                break;
            case "saveCommitDetailsViewMode":
                vscode.workspace.getConfiguration("git-wiz").update("commitDetailsViewMode", msg.mode, vscode.ConfigurationTarget.Global);
                break;
            case "settingsUpdateSetting": {
                const config = vscode.workspace.getConfiguration("git-wiz");
                await config.update(msg.key!, msg.value, vscode.ConfigurationTarget.Global);
                if (msg.key === "showTags") {
                    webview.postMessage({ command: "updateShowTags", value: msg.value });
                }
                if (msg.key === "showRemoteBranches") {
                    webview.postMessage({ command: "updateShowRemoteBranches", value: msg.value });
                }
                if (msg.key === "showGraph") {
                    webview.postMessage({ command: "updateShowGraph", value: msg.value });
                }
                break;
            }
            case "settingsSetGitConfig":
                await this._gitOps.setGitConfig(msg.key!, msg.value as string, msg.scope!);
                break;
            case "settingsGetGitConfig": {
                this._settingsScope = msg.scope!;
                const userName = await this._gitOps.getGitConfig("user.name", this._settingsScope) || "";
                const userEmail = await this._gitOps.getGitConfig("user.email", this._settingsScope) || "";
                webview.postMessage({ command: "settingsUpdateForm", userName, userEmail });
                break;
            }
            case "settingsAddRemote": {
                const name = await vscode.window.showInputBox({ prompt: "Remote name", placeHolder: "origin" });
                if (!name)
                    break;
                const url = await vscode.window.showInputBox({ prompt: `Remote URL for "${name}"`, placeHolder: "https://github.com/user/repo.git" });
                if (!url)
                    break;
                await this._gitOps.addRemote(name, url);
                vscode.commands.executeCommand("git-wiz.refreshBranches");
                webview.postMessage({ command: "settingsUpdateForm", remotes: await this._gitOps.getUniqueRemotes() });
                break;
            }
            case "settingsRemoveRemote":
                await this._gitOps.removeRemote(msg.remoteName!);
                vscode.commands.executeCommand("git-wiz.refreshBranches");
                webview.postMessage({ command: "settingsUpdateForm", remotes: await this._gitOps.getUniqueRemotes() });
                break;
        }
    }

    private execFileCommand(cmd: string, msg: WebviewMessage, webview: vscode.Webview): void {
        switch (cmd) {
            case "getCommitFiles":
                this.getCommitFiles(msg.commitHash!, webview);
                break;
            case "openDiff":
                this.openDiff(msg.commitHash!, msg.filePath!, msg.parentHash);
                break;
            case "openFile":
                this.openFile(msg.filePath!);
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
        }
    }

    private setupGitWatcher() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        this._watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolders[0], ".git/**"),
        );

        this._watcher.onDidChange(() => this.debouncedRefresh());
        this._watcher.onDidCreate(() => this.debouncedRefresh());
        this._watcher.onDidDelete(() => this.debouncedRefresh());
    }

    private getConfig<T>(key: string, defaultValue: T): T {
        return vscode.workspace.getConfiguration("git-wiz").get<T>(key, defaultValue);
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
            return;
        }
        // Branch state may have changed (cherry-pick, rebase, etc.)
        // so invalidate signature cache to ensure fresh highlight matching
        this._branchSignaturesCache = null;
        // Use the current loaded count to ensure we don't shrink the list on refresh
        const countToLoad = Math.max(PAGE_SIZE, this._loadedCount);
        const commits = await this._gitOps.getGitLog(this._filterBranch, 0, countToLoad, this._searchFilters, this._filterFile);
        const currentBranch = await this._gitOps.getCurrentBranch();
        const branches = await this._gitOps.getBranches();
        const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);
        const showTags = this.getConfig("showTags", true);
        const showRemoteBranches = this.getConfig("showRemoteBranches", true);
        const showGraph = this.getConfig("showGraph", true);

        if (highlightCurrentBranch && currentBranch) {
            await this.applyHighlight(commits, currentBranch);
        }

        this.updateViewTitle(currentBranch);

        this._loadedCount = commits.length;
        const hasMore = commits.length >= countToLoad; // Keep hasMore if we hit the limit
        const msg = {
            command: "replaceCommits",
            commits,
            hasMore,
            filterBranch: this._filterBranch,
            filterFile: this._filterFile,
            currentBranch,
            resetScroll,
            highlightCurrentBranch,
            showTags,
            showRemoteBranches,
            showGraph,
        };
        this.postToWebview(msg);
        this.postToWebview({ command: "replaceBranches", branches });
    }

    public dispose() {
        this._watcher?.dispose();
    }

    // Delegated public methods so extension.ts commands can still call them on the provider
    public async cherryPickCommit(commitHash: string) {
        return this._gitOps.cherryPickCommit(commitHash);
    }

    public async copyCommitHash(commitHash: string) {
        return this._gitOps.copyCommitHash(commitHash);
    }

    public async copyCommitMessage(commitHash: string, commitMessage: string) {
        return this._gitOps.copyCommitMessage(commitHash, commitMessage);
    }

    public async revertCommit(commitHash: string) {
        return this._gitOps.revertCommit(commitHash);
    }

    public async resetToCommit(commitHash: string) {
        return this._gitOps.resetToCommit(commitHash);
    }

    public async createNewTag(commitHash: string) {
        const tagName = await vscode.window.showInputBox({
            prompt: "Enter new tag name",
            placeHolder: "e.g. v1.0.0",
        });
        if (tagName) {
            await this._gitOps.createTag(tagName, commitHash);
            this.refresh();
        }
    }

    public async pushTag(tagName: string) {
        return this._gitOps.pushTag(tagName);
    }

    public async createBranchFromCommit(commitHash: string, providedBranchName?: string) {
        const branchName = providedBranchName || await vscode.window.showInputBox({
            prompt: "Enter new branch name",
            placeHolder: "e.g. feature/new-branch",
        });
        if (branchName) {
            await this._gitOps.createBranch(branchName, commitHash);
            this.refresh();
            vscode.commands.executeCommand("git-wiz.refreshBranches");
        }
    }

    public async showSettings() {
        const webview = this._view?.webview || GitGraphViewProvider.currentPanel?.webview;
        if (!webview)
            return;

        const userName = await this._gitOps.getGitConfig("user.name", this._settingsScope) || "";
        const userEmail = await this._gitOps.getGitConfig("user.email", this._settingsScope) || "";

        webview.postMessage({
            command: "showSettingsModal",
            data: {
                highlightCurrentBranch: this.getConfig("highlightCurrentBranch", false),
                showTags: this.getConfig("showTags", true),
                showRemoteBranches: this.getConfig("showRemoteBranches", true),
                showGraph: this.getConfig("showGraph", true),
                userName,
                userEmail,
                scope: this._settingsScope,
                remotes: await this._gitOps.getUniqueRemotes(),
                locale: vscode.env.language,
            },
        });
    }

    private async updateWebview(webview: vscode.Webview) {
        this._initialized = false;
        this._loadedCount = 0;
        const countToLoad = Math.max(PAGE_SIZE, this._loadedCount);
        const commits = await this._gitOps.getGitLog(this._filterBranch, 0, countToLoad, this._searchFilters, this._filterFile);
        const currentBranch = await this._gitOps.getCurrentBranch();
        const branches = await this._gitOps.getBranches();
        const filesViewMode = this.getConfig<"tree" | "list">("filesViewMode", "list");
        const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);
        const showTags = this.getConfig("showTags", true);
        const showRemoteBranches = this.getConfig("showRemoteBranches", true);
        const showGraph = this.getConfig("showGraph", true);

        if (highlightCurrentBranch && currentBranch) {
            await this.applyHighlight(commits, currentBranch);
        }

        this.updateViewTitle(currentBranch);

        this._loadedCount = commits.length;
        const hasMore = commits.length >= countToLoad; // Keep hasMore if we hit the limit
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
        );
        this._initialized = true;
        if (this._pendingRefresh) {
            this._pendingRefresh = false;
            this.refresh();
        }
    }

    private async loadMoreCommits(webview: vscode.Webview) {
        const commits = await this._gitOps.getGitLog(
            this._filterBranch,
            this._loadedCount,
            PAGE_SIZE,
            this._searchFilters,
            this._filterFile,
        );
        const currentBranch = await this._gitOps.getCurrentBranch();
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
        const branchHashes = await this._gitOps.getBranchCommits(currentBranch);

        if (!this._branchSignaturesCache || this._branchSignaturesCache.branch !== currentBranch) {
            const signatures = await this._gitOps.getBranchCommitSignatures(currentBranch);
            this._branchSignaturesCache = { branch: currentBranch, signatures };
        }

        const highlighted = getCurrentBranchHashes(commits, branchHashes, this._branchSignaturesCache.signatures);
        for (const c of commits) {
            if (highlighted.has(c.hash)) {
                c.isCurrentBranch = true;
            }
        }
    }

    private async getCommitFiles(commitHash: string, webview: vscode.Webview) {
        const files = await this._gitOps.getGitLog(null, 0, 1, { query: commitHash });
        if (files.length > 0) {
            const commit = files[0];
            const patch = await new Promise<string>((resolve) => {
                const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (!cwd)
                    return resolve("");
                // Get the patch for the commit
                cp.exec(`git show ${commitHash} --patch`, { cwd }, (err: cp.ExecException | null, stdout: string) => {
                    resolve(err ? "" : stdout);
                });
            });

            const data = {
                fullHash: commit.hash,
                authorEmail: commit.email,
                authorName: commit.author,
                authorDate: commit.date, // Note: parsed string
                commitDate: commit.date, // Simplified for now
                subject: commit.message,
                body: "", // git log output parsing might need refinement for body
                patch,
            };

            const detailsMode = this.getConfig<"tree" | "list">("commitDetailsViewMode", "list");

            if (GitGraphViewProvider.currentPanel) {
                const panelWebview = GitGraphViewProvider.currentPanel.webview;
                panelWebview.html = getCommitDetailsHtml(panelWebview, data, this._extensionUri, detailsMode);
            }
        }

        try {
            const filesData = await this._gitOps.getCommitFiles(commitHash);
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

    private openDiff(commitHash: string, filePath: string, parentHash?: string) {
        const shortCommit = commitHash.substring(0, 7);
        const diffParent = parentHash || `${commitHash}~1`;
        const shortParent = parentHash ? parentHash.substring(0, 7) : `${shortCommit}~1`;

        const fileName = filePath.split("/").pop() || filePath;

        // By changing the path to /hash/filename, VS Code will use hash/filename as the side labels
        // and we pass the actual file path in the 'file' query parameter so the provider can read it.
        const uri1 = vscode.Uri.parse(`git-wiz:/${shortParent}/${fileName}?hash=${diffParent}&file=${encodeURIComponent(filePath)}`);
        const uri2 = vscode.Uri.parse(`git-wiz:/${shortCommit}/${fileName}?hash=${commitHash}&file=${encodeURIComponent(filePath)}`);

        // Provide a clearer title for the diff
        const title = `${fileName} (${shortParent} ↔ ${shortCommit})`;
        vscode.commands.executeCommand("vscode.diff", uri1, uri2, title);
    }

    private openFile(filePath: string) {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!cwd) {
            return;
        }
        vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(vscode.Uri.joinPath(vscode.Uri.file(cwd), filePath).fsPath),
        );
    }
}
