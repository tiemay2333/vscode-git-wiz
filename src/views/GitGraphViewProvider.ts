import type { DataManagerRegistry } from "./dataManager/DataManagerRegistry";
import type { IViewDataManager, ViewDataSnapshot } from "./dataManager/IViewDataManager";
import type { FromWebviewMessage } from "./types/WebviewProtocol";
import type { SearchFilters } from "@/core/graphState";
import type { BaseWorkflow } from "@/git/workflow/base";
import * as vscode from "vscode";
import { t } from "@/locale/i18n";
import { CoreHandler, FileHandler, GitCommandHandler, SettingsHandler, UIStateHandler } from "./handlers";
import { MessageDispatcher } from "./MessageDispatcher";
import { getHtmlForWebview } from "./webviewContent";
import { WebviewMessenger } from "./WebviewMessenger";

export class GitGraphViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    public static readonly viewType = "gitLeanGraphView";
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentProvider: GitGraphViewProvider | undefined;

    private _disposables: vscode.Disposable[] = [];
    private _dataManager: IViewDataManager;
    private _loadingCount = 0;

    private readonly _messenger: WebviewMessenger;
    private _dispatcher!: MessageDispatcher;

    private _settingsScope: "local" | "global" = "global";

    constructor(
        private readonly _extensionUri: vscode.Uri,
        public cwd: string,
        private readonly _registry: DataManagerRegistry,
    ) {
        this._dataManager = this._registry.getManagerForPath(this.cwd);
        this._messenger = new WebviewMessenger();

        this._initHandlers();
        this.subscribeToEvents();
    }

    private _initHandlers() {
        this._dispatcher?.dispose();
        this._dispatcher = new MessageDispatcher();

        // eslint-disable-next-line ts/no-this-alias
        const provider = this;

        // Register Core Handler
        this._dispatcher.register(new CoreHandler(
            this._extensionUri,
            this._dataManager,
            this._messenger,
            (k, d) => this.getConfig(k, d),
        ));

        // Register Git Command Handler
        this._dispatcher.register(new GitCommandHandler(
            this._dataManager.workflowEngine,
            branch => this.filterByBranch(branch),
        ));

        // Register Settings Handler
        this._dispatcher.register(new SettingsHandler(
            this._dataManager.gitService,
            () => this._dataManager.refs.getUniqueRemotes(),
            (scope) => { this._settingsScope = scope; },
            visible => this.setLoading(visible),
        ));

        // Register File Handler
        this._dispatcher.register(new FileHandler());

        // Register UI State Handler
        this._dispatcher.register(new UIStateHandler(
            {
                get filterBranch() { return provider._dataManager.getSnapshot()?.filterBranch ?? null; },
                get filterFile() { return provider._dataManager.getSnapshot()?.filterFile ?? null; },
                get searchFilters() { return provider._dataManager.getSnapshot()?.searchFilters; },
                get loadedCount() { return provider._dataManager.getSnapshot()?.loadedCount ?? 0; },
                set filterBranch(v: string | null) { provider._dataManager.setFilterBranch(v); },
                set filterFile(v: string | null) { provider._dataManager.setFilterFile(v); },
                set searchFilters(v: SearchFilters | undefined) { provider._dataManager.setSearchFilters(v); },
                set loadedCount(_v: number) { /* handled by VDM */ },
                resetFilters: () => {
                    provider._dataManager.setFilterBranch(null);
                    provider._dataManager.setFilterFile(null);
                    provider._dataManager.setSearchFilters(undefined);
                },
            } as any,
            (reset?: boolean) => this.refresh(reset),
            (webview: vscode.Webview) => this.updateWebview(webview),
            (_webview: vscode.Webview) => this._dataManager.loadMoreCommits(),
            async (_webview: vscode.Webview) => {
                this._dataManager.setSearchFilters(undefined);
                this._dataManager.refreshAll({ resetScroll: true });
            },
        ));
    }

    private subscribeToEvents() {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];

        // Subscribe to VDM snapshot updates
        this._disposables.push(this._dataManager.onDidUpdateSnapshot((snapshot) => {
            this._handleSnapshotUpdate(snapshot);
        }));

        this._disposables.push(this._dataManager.onDidUpdateCommitHighlight((e: { hash: string; verificationStatus: string }) => {
            this._messenger.postMessage({ command: "updateCommitHighlight", hash: e.hash, verificationStatus: e.verificationStatus });
        }));

        this._disposables.push(this._dataManager.onDidUpdateLoading((visible) => {
            this._messenger.postMessage({ command: "setLoading", visible });
        }));
    }

    private _handleSnapshotUpdate(snapshot: ViewDataSnapshot) {
        const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);
        const showTags = this.getConfig("showTags", true);
        const showRemoteBranches = this.getConfig("showRemoteBranches", true);
        const showGraph = this.getConfig("showGraph", true);

        this.updateViewTitle(snapshot.currentBranch, snapshot.filterBranch, snapshot.filterFile);

        if (snapshot.isIncremental) {
            this._messenger.postMessage({
                command: "appendCommits",
                commits: snapshot.commits,
                uiStatus: snapshot.uiStatus,
                hasMore: snapshot.hasMore,
                showTags,
                showRemoteBranches,
                showGraph,
            });
        }
        else {
            this._messenger.postMessage({
                command: "replaceCommits",
                commits: snapshot.commits,
                uiStatus: snapshot.uiStatus,
                hasMore: snapshot.hasMore,
                filterBranch: snapshot.filterBranch,
                filterFile: snapshot.filterFile,
                currentBranch: snapshot.currentBranch,
                resetScroll: !!snapshot.resetScroll,
                highlightCurrentBranch,
                showTags,
                showRemoteBranches,
                showGraph,
            });
            this._messenger.postMessage({ command: "replaceBranches", branches: snapshot.branches });
        }
    }

    public updateCwd(newCwd: string) {
        if (this.cwd === newCwd)
            return;
        this.cwd = newCwd;
        this._dataManager = this._registry.getManagerForPath(this.cwd);

        this._initHandlers();
        this.subscribeToEvents();
        this._dataManager.setFilterBranch(null);
        this._dataManager.setFilterFile(null);
        this._dataManager.setSearchFilters(undefined);
        this.refresh(true);
    }

    public filterByBranch(branch: string | null) {
        this._dataManager.setFilterBranch(branch);
    }

    public filterByFile(filePath: string | null) {
        this._dataManager.setFilterFile(filePath);
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
            if (webviewView.visible) {
                this.refresh();
            }
        });

        webviewView.onDidDispose(() => {
            this._dataManager.setReady(false);
        });

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.onDidReceiveMessage(message => this.handleMessage(message, webviewView.webview));

        this.updateWebview(webviewView.webview);
    }

    private async handleMessage(message: FromWebviewMessage, webview: vscode.Webview) {
        await this._dispatcher.dispatch(message, webview);
    }

    private getConfig<T>(key: string, defaultValue: T): T {
        return vscode.workspace.getConfiguration("git-wiz").get<T>(key, defaultValue);
    }

    private updateViewTitle(currentBranch: string | null, filterBranch: string | null, filterFile: string | null) {
        let title = "Tree";
        if (filterFile) {
            title += ` - ${filterFile}`;
        }
        else if (filterBranch) {
            title += ` - ${filterBranch}`;
            if (currentBranch && filterBranch !== currentBranch) {
                title += ` (HEAD on ${currentBranch})`;
            }
        }
        else {
            title += " - All Branches";
            if (currentBranch) {
                title += ` (HEAD on ${currentBranch})`;
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

    public async executeWorkflow<T>(workflow: BaseWorkflow<T>): Promise<T | undefined> {
        return await this._dataManager.workflowEngine.execute(workflow);
    }

    public dispose() {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
        this._dispatcher.dispose();
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
        this._dataManager.setReady(false);
        try {
            const currentBranch = await this._dataManager.refs.getCurrentBranch();
            const branches = await this._dataManager.refs.getBranches();
            const filesViewMode = this.getConfig<"tree" | "list">("filesViewMode", "list");
            const highlightCurrentBranch = this.getConfig("highlightCurrentBranch", false);
            const showTags = this.getConfig("showTags", true);
            const showRemoteBranches = this.getConfig("showRemoteBranches", true);
            const showGraph = this.getConfig("showGraph", true);
            const searchDefaultMode = this.getConfig("searchDefaultMode", "single");

            // Initial load from VDM
            this._dataManager.refreshAll({ resetScroll: true });
            const snapshot = this._dataManager.getSnapshot();

            this.updateViewTitle(currentBranch, snapshot?.filterBranch || null, snapshot?.filterFile || null);

            webview.html = getHtmlForWebview(
                webview,
                snapshot?.commits || [],
                branches,
                snapshot?.hasMore || false,
                snapshot?.filterBranch || null,
                currentBranch,
                this._extensionUri,
                filesViewMode,
                snapshot?.filterFile || null,
                highlightCurrentBranch,
                showTags,
                showRemoteBranches,
                showGraph,
                searchDefaultMode,
                vscode.env.language,
                snapshot?.uiStatus || {},
            );
        }
        finally {
            // Note: VDM.setReady(true) happens via 'ready' message
        }
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
