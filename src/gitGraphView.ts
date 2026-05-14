import type { GitCommit } from "./gitOperations";
import * as vscode from "vscode";
import { getCurrentBranchHashes } from "./git/commitHighlight";
import { GitService } from "./gitOperations";
import { getCommitDetailsHtml, getHtmlForWebview } from "./webviewContent";

const PAGE_SIZE = 200;

class AsyncHighlightVerifier {
    private _queue: { hash: string; targets: string[] }[] = [];
    private _inProgress = 0;
    private readonly MAX_CONCURRENCY = 3;
    private _patchIdCache = new Map<string, string>();

    constructor(
        private readonly _gitService: GitService,
        private readonly _onUpdate: (hash: string, status: "verified" | "failed") => void,
    ) { }

    public queueVerification(hash: string, targets: string[]) {
        if (this._queue.some(q => q.hash === hash))
            return;
        this._queue.push({ hash, targets });
        this.processQueue();
    }

    public reset() {
        this._queue = [];
        this._patchIdCache.clear();
    }

    private async processQueue() {
        if (this._inProgress >= this.MAX_CONCURRENCY || this._queue.length === 0)
            return;

        const item = this._queue.shift()!;
        this._inProgress++;

        try {
            const status = await this.verify(item.hash, item.targets);
            this._onUpdate(item.hash, status);
        }
        catch {
            this._onUpdate(item.hash, "failed");
        }
        finally {
            this._inProgress--;
            this.processQueue();
        }
    }

    private async getPatchId(hash: string): Promise<string> {
        let pid = this._patchIdCache.get(hash);
        if (pid === undefined) {
            pid = await this._gitService.getPatchId(hash);
            this._patchIdCache.set(hash, pid);
        }
        return pid;
    }

    private async verify(hash: string, targets: string[]): Promise<"verified" | "failed"> {
        const sourcePid = await this.getPatchId(hash);
        for (const target of targets) {
            const targetPid = await this.getPatchId(target);
            if (sourcePid === targetPid && sourcePid !== "") {
                return "verified";
            }
        }

        return "failed";
    }
}

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

export class GitGraphViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    public static readonly viewType = "gitLeanGraphView";
    private static currentPanel: vscode.WebviewPanel | undefined;
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

    constructor(private readonly _extensionUri: vscode.Uri) {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
        this._gitService = new GitService({ cwd });
        this._verifier = new AsyncHighlightVerifier(this._gitService, (hash, status) => {
            this.postToWebview({ command: "updateCommitHighlight", hash, verificationStatus: status });
        });
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

        if (cmd === "reverifyCommit" && message.commitHash) {
            const commits = await this._gitService.getGitLog(null, 0, 1, { query: message.commitHash });
            if (commits.length > 0) {
                const commit = commits[0];
                const currentBranch = await this._gitService.getCurrentBranch();
                if (currentBranch) {
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
            }
            return;
        }

        // git operations
        if (cmd === "cherryPick"
            || cmd === "copyHash" || cmd === "copyCommitMessage"
            || cmd === "revertCommit" || cmd === "resetToCommit"
            || cmd === "dropCommit" || cmd === "squashCommits" || cmd === "cherryPickRange"
            || cmd === "revertCommits" || cmd === "dropCommits" || cmd === "pushTag") {
            await this.execGitOperation(cmd, message);
            return;
        }
        // branch/tag operations
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
        // UI state management
        this.handleUIState(cmd, message, webview);
    }

    private async execGitOperation(cmd: string, msg: WebviewMessage): Promise<void> {
        try {
            switch (cmd) {
                case "cherryPick":
                    await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Cherry-picking commit ${msg.commitHash!.substring(0, 7)}...` }, async () => {
                        await this._gitService.cherryPickCommit(msg.commitHash!);
                        vscode.window.showInformationMessage("Commit cherry-picked successfully");
                        this.refresh();
                    });
                    break;
                case "copyHash":
                    await vscode.env.clipboard.writeText(msg.commitHash!);
                    vscode.window.showInformationMessage("Commit hash copied to clipboard");
                    break;
                case "copyCommitMessage":
                    await vscode.env.clipboard.writeText(msg.commitMessage!);
                    vscode.window.showInformationMessage("Commit message copied to clipboard");
                    break;
                case "revertCommit": {
                    const confirm = await vscode.window.showWarningMessage(`Are you sure you want to revert commit ${msg.commitHash!.substring(0, 7)}?`, "Yes", "No");
                    if (confirm === "Yes") {
                        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Reverting commit ${msg.commitHash!.substring(0, 7)}...` }, async () => {
                            await this._gitService.revertCommit(msg.commitHash!);
                            vscode.window.showInformationMessage("Commit reverted successfully");
                            this.refresh();
                        });
                    }
                    break;
                }
                case "resetToCommit": {
                    const items: (vscode.QuickPickItem & { value: string })[] = [
                        { label: "Soft", description: "Keep changes staged", value: "--soft" },
                        { label: "Mixed", description: "Keep changes unstaged", value: "--mixed" },
                        { label: "Hard", description: "Discard all changes", value: "--hard" },
                    ];
                    const resetType = await vscode.window.showQuickPick(items, { placeHolder: "Select reset type" });
                    if (resetType) {
                        const confirm = await vscode.window.showWarningMessage(`Are you sure you want to reset to commit ${msg.commitHash!.substring(0, 7)} (${resetType.label})?`, "Yes", "No");
                        if (confirm === "Yes") {
                            await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Resetting to commit ${msg.commitHash!.substring(0, 7)} (${resetType.label})...` }, async () => {
                                await this._gitService.resetToCommit(msg.commitHash!, resetType.value);
                                vscode.window.showInformationMessage(`Reset to commit ${msg.commitHash!.substring(0, 7)} successfully`);
                                this.refresh();
                            });
                        }
                    }
                    break;
                }
                case "dropCommit": {
                    const confirm = await vscode.window.showWarningMessage(`Are you sure you want to permanently drop commit ${msg.commitHash!.substring(0, 7)}? This cannot be undone.`, "Drop", "Cancel");
                    if (confirm === "Drop") {
                        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Dropping commit ${msg.commitHash!.substring(0, 7)}...` }, async () => {
                            await this._gitService.dropCommit(msg.commitHash!);
                            vscode.window.showInformationMessage("Commit dropped successfully");
                            this.refresh();
                        });
                    }
                    break;
                }
                case "squashCommits": {
                    const newMessage = await vscode.window.showInputBox({
                        prompt: `Squash ${msg.hashes!.length} commits into one`,
                        placeHolder: "New commit message",
                        validateInput: v => (!v || !v.trim() ? "Message cannot be empty" : null),
                    });
                    if (newMessage) {
                        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Squashing ${msg.hashes!.length} commits...` }, async () => {
                            await this._gitService.squashCommits(msg.hashes!, msg.parentHash!, newMessage);
                            vscode.window.showInformationMessage(`Squashed ${msg.hashes!.length} commits successfully`);
                            this.refresh();
                        });
                    }
                    break;
                }
                case "cherryPickRange":
                    await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Cherry-picking ${msg.hashes!.length} commits...` }, async () => {
                        await this._gitService.cherryPickRange(msg.hashes!);
                        vscode.window.showInformationMessage(`Cherry-picked ${msg.hashes!.length} commits successfully`);
                        this.refresh();
                    });
                    break;
                case "revertCommits": {
                    const confirm = await vscode.window.showWarningMessage(`Are you sure you want to revert ${msg.hashes!.length} commits? This will create ${msg.hashes!.length} new revert commits.`, "Yes", "No");
                    if (confirm === "Yes") {
                        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Reverting ${msg.hashes!.length} commits...` }, async () => {
                            await this._gitService.revertCommits(msg.hashes!);
                            vscode.window.showInformationMessage(`Reverted ${msg.hashes!.length} commits successfully`);
                            this.refresh();
                        });
                    }
                    break;
                }
                case "dropCommits": {
                    const confirm = await vscode.window.showWarningMessage(`Are you sure you want to permanently drop ${msg.hashes!.length} commits? This cannot be undone.`, "Drop", "Cancel");
                    if (confirm === "Drop") {
                        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Dropping ${msg.hashes!.length} commits...` }, async () => {
                            await this._gitService.dropCommits(msg.hashes!, msg.parentHash!);
                            vscode.window.showInformationMessage(`Dropped ${msg.hashes!.length} commits successfully`);
                            this.refresh();
                        });
                    }
                    break;
                }
                case "pushTag":
                    await this.pushTag(msg.tagName!);
                    break;
            }
        }
        catch (e: any) {
            vscode.window.showErrorMessage(e.message || "Operation failed");
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
                if (msg.key === "searchDefaultMode") {
                    webview.postMessage({ command: "updateSearchDefaultMode", value: msg.value });
                }
                break;
            }
            case "settingsSetGitConfig":
                await this._gitService.setGitConfig(msg.key!, msg.value as string, msg.scope!);
                break;
            case "settingsGetGitConfig": {
                this._settingsScope = msg.scope!;
                const userName = await this._gitService.getGitConfig("user.name", this._settingsScope) || "";
                const userEmail = await this._gitService.getGitConfig("user.email", this._settingsScope) || "";
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
                await this._gitService.addRemote(name, url);
                vscode.commands.executeCommand("git-wiz.refreshBranches");
                webview.postMessage({ command: "settingsUpdateForm", remotes: await this._gitService.getUniqueRemotes() });
                break;
            }
            case "settingsRemoveRemote":
                await this._gitService.removeRemote(msg.remoteName!);
                vscode.commands.executeCommand("git-wiz.refreshBranches");
                webview.postMessage({ command: "settingsUpdateForm", remotes: await this._gitService.getUniqueRemotes() });
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

    public dispose() {
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }
        this._watchers.forEach(w => w.dispose());
        this._watchers = [];
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
                    await this._gitService.createBranch(branchName, commitHash);
                    vscode.window.showInformationMessage(`Branch '${branchName}' created successfully`);
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
                panelWebview.html = getCommitDetailsHtml(panelWebview, data, this._extensionUri, detailsMode);
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

    private openDiff(commitHash: string, filePath: string, parentHash?: string) {
        const shortCommit = commitHash.substring(0, 7);
        const diffParent = parentHash || `${commitHash}~1`;
        const shortParent = parentHash ? parentHash.substring(0, 7) : `${shortCommit}~1`;

        const fileName = filePath.split("/").pop() || filePath;

        const uri1 = vscode.Uri.parse(`git-wiz:/${shortParent}/${fileName}?hash=${diffParent}&file=${encodeURIComponent(filePath)}`);
        const uri2 = vscode.Uri.parse(`git-wiz:/${shortCommit}/${fileName}?hash=${commitHash}&file=${encodeURIComponent(filePath)}`);

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

    // Delegated public methods for extension.ts commands
    public async cherryPickCommit(commitHash: string) {
        return vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `Cherry-picking commit ${commitHash.substring(0, 7)}...` }, async () => {
            try {
                await this._gitService.cherryPickCommit(commitHash);
                vscode.window.showInformationMessage("Commit cherry-picked successfully");
                this.refresh();
            }
            catch (e: any) {
                vscode.window.showErrorMessage(e.message || "Cherry-pick failed");
            }
        });
    }

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
