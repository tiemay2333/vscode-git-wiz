import type { IViewDataManager } from "../dataManager/IViewDataManager";
import type { FromWebviewMessage } from "../types/WebviewProtocol";
import type { WebviewMessenger } from "../WebviewMessenger";
import type { IMessageHandler } from "./IMessageHandler";
import * as vscode from "vscode";
import { getCommitDetailsHtml } from "../webviewContent";

export class CoreHandler implements IMessageHandler {
    readonly commands: FromWebviewMessage["command"][] = [
        "ready",
        "reverifyCommit",
        "getCommitFiles",
    ];

    readonly immediateCommands: FromWebviewMessage["command"][] = ["ready"];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _dataManager: IViewDataManager,
        private readonly _messenger: WebviewMessenger,
        private readonly _getConfig: <T>(key: string, defaultValue: T) => T,
    ) { }

    dispose(): void { }

    async handle(msg: FromWebviewMessage, webview: vscode.Webview): Promise<void> {
        switch (msg.command) {
            case "ready":
                this._dataManager.setReady(true);
                break;
            case "reverifyCommit":
                await this._dataManager.reverifyCommit(msg.commitHash);
                break;
            case "getCommitFiles":
                await this._getCommitFiles(msg.commitHash, webview);
                break;
        }
    }

    private async _getCommitFiles(commitHash: string, _webview: vscode.Webview) {
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

            const detailsMode = this._getConfig<"tree" | "list">("commitDetailsViewMode", "list");

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
}
