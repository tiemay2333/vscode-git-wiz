import type { GraphState } from "@/core/GraphState";
import type { FromWebviewMessage } from "@/views/types/WebviewProtocol";
import * as vscode from "vscode";

export class UIStateHandler implements vscode.Disposable {
    constructor(
        private readonly _state: GraphState,
        private readonly _refresh: (resetScroll?: boolean) => Promise<void>,
        private readonly _updateWebview: (webview: vscode.Webview) => Promise<void>,
        private readonly _loadMoreCommits: (webview: vscode.Webview) => Promise<void>,
        private readonly _requestUnfilteredCommits: (webview: vscode.Webview) => Promise<void>,
    ) { }

    dispose(): void {
        // No resources to manage
    }

    async handle(msg: FromWebviewMessage, webview: vscode.Webview): Promise<void> {
        switch (msg.command) {
            case "search":
                this._state.searchFilters = msg.filters;
                await this._refresh(true);
                break;
            case "refresh":
                await this._updateWebview(webview);
                break;
            case "clearBranchFilter":
                this._state.filterBranch = null;
                await this._refresh(true);
                break;
            case "filterByFile":
                this._state.filterFile = msg.filePath;
                await this._refresh(true);
                break;
            case "clearFileFilter":
                this._state.filterFile = null;
                await this._refresh(true);
                break;
            case "loadMoreCommits":
                await this._loadMoreCommits(webview);
                break;
            case "showErrorMessage":
                vscode.window.showErrorMessage(msg.error || "Unknown error");
                break;
            case "requestUnfilteredCommits":
                await this._requestUnfilteredCommits(webview);
                break;
        }
    }
}
