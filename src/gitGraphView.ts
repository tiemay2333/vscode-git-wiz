import * as vscode from 'vscode';
import * as cp from 'child_process';
import { GitOperations } from './gitOperations';
import { getHtmlForWebview, getCommitDetailsHtml } from './webviewContent';

const PAGE_SIZE = 200;

interface WebviewMessage {
    command: string;
    commitHash?: string;
    newMessage?: string;
    hashes?: string[];
    parentHash?: string;
    filePath?: string;
    filters?: { query?: string; author?: string; from?: string; to?: string };
    branchName?: string;
    branchNames?: string[];
    tagName?: string;
    mode?: 'list' | 'tree';
    error?: string;
}

export class GitGraphViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'gitLeanGraphView';
    private static currentPanel: vscode.WebviewPanel | undefined;
    private _view?: vscode.WebviewView;
    private _watcher?: vscode.FileSystemWatcher;
    private _filterBranch: string | null = null;
    private _loadedCount = 0;
    private _searchFilters?: { query?: string; author?: string; from?: string; to?: string };
    private readonly _gitOps: GitOperations;
    private _refreshTimer?: ReturnType<typeof setTimeout>;
    private _initialized = false;
    private _isFirstLoad = true;

    constructor(private readonly _extensionUri: vscode.Uri) {
        this._gitOps = new GitOperations(() => this.refresh());
        this.setupGitWatcher();
    }

    public filterByBranch(branch: string | null) {
        this._filterBranch = branch;
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
            'Tree',
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

        panel.webview.onDidReceiveMessage((message) => provider.handleMessage(message, panel.webview));
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.onDidReceiveMessage((message) => this.handleMessage(message, webviewView.webview));

        this.updateWebview(webviewView.webview);
        this._initialized = true;
    }

    private handleMessage(message: WebviewMessage, webview: vscode.Webview) {
        switch (message.command) {
            case 'search':
                this._searchFilters = message.filters;
                this._initialized = true; // ensure refresh can run
                this.refresh(true);
                break;
            case 'refresh':
                this.updateWebview(webview);
                break;
            case 'clearBranchFilter':
                this._filterBranch = null;
                this.refresh(true);
                break;
            case 'loadMoreCommits':
                this.loadMoreCommits(webview);
                break;
            case 'editCommitMessage':
                this._gitOps.editCommitMessage(message.commitHash!, message.newMessage!);
                break;
            case 'amendCommit':
                this._gitOps.amendCommit();
                break;
            case 'cherryPick':
                this._gitOps.cherryPickCommit(message.commitHash!);
                break;
            case 'copyHash':
                this._gitOps.copyCommitHash(message.commitHash!);
                break;
            case 'revertCommit':
                this._gitOps.revertCommit(message.commitHash!);
                break;
            case 'resetToCommit':
                this._gitOps.resetToCommit(message.commitHash!);
                break;
            case 'dropCommit':
                this._gitOps.dropCommit(message.commitHash!);
                break;
            case 'squashCommits':
                this._gitOps.squashCommits(message.hashes!, message.parentHash!);
                break;
            case 'cherryPickRange':
                this._gitOps.cherryPickRange(message.hashes!);
                break;
            case 'revertCommits':
                this._gitOps.revertCommits(message.hashes!);
                break;
            case 'dropCommits':
                this._gitOps.dropCommits(message.hashes!, message.parentHash!);
                break;
            case 'newTag':
                this.createNewTag(message.commitHash!);
                break;
            case 'pushTag':
                this._gitOps.pushTag(message.tagName!);
                break;
            case 'createBranch':
                this.createBranchFromCommit(message.commitHash!);
                break;
            case 'selectBranch':
                this.filterByBranch(message.branchName || null);
                break;
            case 'deleteMultipleBranches':
                vscode.commands.executeCommand('git-wiz.deleteMultipleBranches', message.branchNames);
                break;
            case 'createBranchFromTag':
            case 'deleteTag':
                vscode.commands.executeCommand(`git-wiz.${message.command}`, message.tagName);
                break;
            case 'checkoutBranch':
            case 'deleteBranch':
            case 'deleteRemoteBranch':
            case 'rebaseBranch':
            case 'mergeBranch':
                vscode.commands.executeCommand(`git-wiz.${message.command}`, { branchName: message.branchName });
                break;
            case 'getCommitFiles':
                this.getCommitFiles(message.commitHash!, webview);
                break;
            case 'saveFilesViewMode':
                const mode = message.mode;
                vscode.workspace
                    .getConfiguration('git-wiz')
                    .update('filesViewMode', mode, vscode.ConfigurationTarget.Global);
                break;
            case 'saveCommitDetailsViewMode':
                const detailsMode = message.mode;
                vscode.workspace
                    .getConfiguration('git-wiz')
                    .update('commitDetailsViewMode', detailsMode, vscode.ConfigurationTarget.Global);
                break;
            case 'openDiff':
                this.openDiff(message.commitHash!, message.filePath!);
                break;
            case 'openFile':
                this.openFile(message.filePath!);
                break;
            case 'showErrorMessage':
                vscode.window.showErrorMessage(message.error || 'Unknown error');
                break;
        }
    }

    private setupGitWatcher() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        this._watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolders[0], '.git/**'),
        );

        this._watcher.onDidChange(() => this.debouncedRefresh());
        this._watcher.onDidCreate(() => this.debouncedRefresh());
        this._watcher.onDidDelete(() => this.debouncedRefresh());
    }

    private debouncedRefresh() {
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }
        this._refreshTimer = setTimeout(() => this.refresh(), 500);
    }

    private updateViewTitle(_currentBranch: string | null) {
        if (GitGraphViewProvider.currentPanel) {
            let title = 'Tree';
            if (this._filterBranch) {
                title += ` - ${this._filterBranch}`;
                if (_currentBranch && this._filterBranch !== _currentBranch) {
                    title += ` (HEAD on ${_currentBranch})`;
                }
            } else {
                title += ' - All Branches';
                if (_currentBranch) {
                    title += ` (HEAD on ${_currentBranch})`;
                }
            }
            GitGraphViewProvider.currentPanel.title = title;
        }
    }

    public async refresh(resetScroll: boolean = false) {
        if (!this._initialized) {
            return;
        }
        // Use the current loaded count to ensure we don't shrink the list on refresh
        const countToLoad = Math.max(PAGE_SIZE, this._loadedCount);
        const commits = await this._gitOps.getGitLog(this._filterBranch, 0, countToLoad, this._searchFilters);
        const currentBranch = await this._gitOps.getCurrentBranch();
        const branches = await this._gitOps.getBranches();

        this.updateViewTitle(currentBranch);

        this._loadedCount = commits.length;
        const hasMore = commits.length >= countToLoad; // Keep hasMore if we hit the limit
        const msg = {
            command: 'replaceCommits',
            commits,
            hasMore,
            filterBranch: this._filterBranch,
            currentBranch,
            resetScroll,
        };
        const branchMsg = {
            command: 'replaceBranches',
            branches,
        };
        this._view?.webview.postMessage(msg);
        this._view?.webview.postMessage(branchMsg);
        GitGraphViewProvider.currentPanel?.webview.postMessage(msg);
        GitGraphViewProvider.currentPanel?.webview.postMessage(branchMsg);
    }

    public dispose() {
        this._watcher?.dispose();
    }

    // Delegated public methods so extension.ts commands can still call them on the provider
    public async editCommitMessage(commitHash: string, newMessage?: string) {
        return this._gitOps.editCommitMessage(commitHash, newMessage);
    }

    public async cherryPickCommit(commitHash: string) {
        return this._gitOps.cherryPickCommit(commitHash);
    }

    public async copyCommitHash(commitHash: string) {
        return this._gitOps.copyCommitHash(commitHash);
    }

    public async revertCommit(commitHash: string) {
        return this._gitOps.revertCommit(commitHash);
    }

    public async resetToCommit(commitHash: string) {
        return this._gitOps.resetToCommit(commitHash);
    }

    public async createNewTag(commitHash: string) {
        const tagName = await vscode.window.showInputBox({
            prompt: 'Enter new tag name',
            placeHolder: 'e.g. v1.0.0',
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
            prompt: 'Enter new branch name',
            placeHolder: 'e.g. feature/new-branch',
        });
        if (branchName) {
            await this._gitOps.createBranch(branchName, commitHash);
            this.refresh();
            vscode.commands.executeCommand('git-wiz.refreshBranches');
        }
    }

    private async updateWebview(webview: vscode.Webview) {
        this._initialized = false;
        this._loadedCount = 0;
        const countToLoad = Math.max(PAGE_SIZE, this._loadedCount);
        const commits = await this._gitOps.getGitLog(this._filterBranch, 0, countToLoad, this._searchFilters);
        const currentBranch = await this._gitOps.getCurrentBranch();
        const branches = await this._gitOps.getBranches();
        const filesViewMode = vscode.workspace
            .getConfiguration('git-wiz')
            .get<'tree' | 'list'>('filesViewMode', 'list');

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
        );
        this._initialized = true;
    }

    private async loadMoreCommits(webview: vscode.Webview) {
        const commits = await this._gitOps.getGitLog(
            this._filterBranch,
            this._loadedCount,
            PAGE_SIZE,
            this._searchFilters,
        );
        this._loadedCount += commits.length;
        const hasMore = commits.length === PAGE_SIZE;
        webview.postMessage({ command: 'appendCommits', commits, hasMore });
    }

    private async getCommitFiles(commitHash: string, webview: vscode.Webview) {
        const files = await this._gitOps.getGitLog(null, 0, 1, { query: commitHash });
        if (files.length > 0) {
            const commit = files[0];
            const patch = await new Promise<string>((resolve) => {
                const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (!cwd) return resolve('');
                // Get the patch for the commit
                cp.exec(`git show ${commitHash} --patch`, { cwd }, (err: cp.ExecException | null, stdout: string) => {
                    resolve(err ? '' : stdout);
                });
            });

            const data = {
                fullHash: commit.hash,
                authorEmail: commit.email,
                authorName: commit.author,
                authorDate: commit.date, // Note: parsed string
                commitDate: commit.date, // Simplified for now
                subject: commit.message,
                body: '', // git log output parsing might need refinement for body
                patch: patch,
            };

            const detailsMode = vscode.workspace
                .getConfiguration('git-wiz')
                .get<'tree' | 'list'>('commitDetailsViewMode', 'list');

            if (GitGraphViewProvider.currentPanel) {
                const panelWebview = GitGraphViewProvider.currentPanel.webview;
                panelWebview.html = getCommitDetailsHtml(panelWebview, data, this._extensionUri, detailsMode);
            }
        }

        try {
            const filesData = await this._gitOps.getCommitFiles(commitHash);
            webview.postMessage({ command: 'commitFilesData', commitHash, files: filesData });
        } catch (e: any) {
            webview.postMessage({
                command: 'commitFilesData',
                commitHash,
                error: e.message || 'Failed to load commit files',
            });
        }
    }

    private openDiff(commitHash: string, filePath: string) {
        const uri1 = vscode.Uri.parse(`git-wiz:/${filePath}?hash=${commitHash}~1`);
        const uri2 = vscode.Uri.parse(`git-wiz:/${filePath}?hash=${commitHash}`);

        // Provide a clearer title for the diff
        const title = `${filePath} (${commitHash.substring(0, 7)}~1 ↔ ${commitHash.substring(0, 7)})`;
        vscode.commands.executeCommand('vscode.diff', uri1, uri2, title);
    }

    private openFile(filePath: string) {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!cwd) {
            return;
        }
        vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.file(vscode.Uri.joinPath(vscode.Uri.file(cwd), filePath).fsPath),
        );
    }
}
