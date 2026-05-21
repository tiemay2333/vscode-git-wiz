import type { GitService } from "@/git/core/GitService";
import type { FromWebviewMessage } from "@/views/types/WebviewProtocol";
import * as vscode from "vscode";
import { t } from "@/locale/i18n";

export class SettingsHandler implements vscode.Disposable {
    constructor(
        private readonly _gitService: GitService,
        private readonly _getUniqueRemotes: () => Promise<{ name: string; url: string }[]>,
        private readonly _setScope: (scope: "local" | "global") => void,
        private readonly _setLoading: (visible: boolean) => void,
    ) { }

    dispose(): void {
        // No resources to manage
    }

    async handle(msg: FromWebviewMessage, webview: vscode.Webview): Promise<void> {
        const locale = vscode.env.language;
        switch (msg.command) {
            case "saveFilesViewMode":
                vscode.workspace.getConfiguration("git-wiz").update("filesViewMode", msg.mode, vscode.ConfigurationTarget.Global);
                break;
            case "saveCommitDetailsViewMode":
                vscode.workspace.getConfiguration("git-wiz").update("commitDetailsViewMode", msg.mode, vscode.ConfigurationTarget.Global);
                break;
            case "settingsUpdateSetting": {
                const config = vscode.workspace.getConfiguration("git-wiz");
                await config.update(msg.key, msg.value, vscode.ConfigurationTarget.Global);
                if (msg.key === "showTags") {
                    webview.postMessage({ command: "updateShowTags", value: msg.value });
                }
                else if (msg.key === "showRemoteBranches") {
                    webview.postMessage({ command: "updateShowRemoteBranches", value: msg.value });
                }
                else if (msg.key === "showGraph") {
                    webview.postMessage({ command: "updateShowGraph", value: msg.value });
                }
                else if (msg.key === "searchDefaultMode") {
                    webview.postMessage({ command: "updateSearchDefaultMode", value: msg.value });
                }
                break;
            }
            case "settingsSetGitConfig":
                await this._gitService.setGitConfig(msg.key, msg.value, msg.scope);
                break;
            case "settingsGetGitConfig": {
                const scope = msg.scope;
                this._setScope(scope);
                const userName = await this._gitService.getGitConfig("user.name", scope) || "";
                const userEmail = await this._gitService.getGitConfig("user.email", scope) || "";
                webview.postMessage({ command: "settingsUpdateForm", userName, userEmail });
                break;
            }
            case "settingsAddRemote": {
                const name = await vscode.window.showInputBox({
                    prompt: t(locale, "remoteNamePrompt"),
                    placeHolder: t(locale, "remoteNamePlaceholder"),
                });
                if (!name)
                    break;
                const url = await vscode.window.showInputBox({
                    prompt: t(locale, "remoteUrlPrompt", { name }),
                    placeHolder: t(locale, "remoteUrlPlaceholder"),
                });
                if (!url)
                    break;

                try {
                    this._setLoading(true);
                    await this._gitService.addRemote(name, url);
                    vscode.commands.executeCommand("git-wiz.refreshBranches");
                    webview.postMessage({ command: "settingsUpdateForm", remotes: await this._getUniqueRemotes() });
                }
                catch (err: any) {
                    vscode.window.showErrorMessage(t(locale, "addRemoteError", { name, error: err.message }));
                }
                finally {
                    this._setLoading(false);
                }
                break;
            }
            case "settingsFetchRemote": {
                const name = msg.remoteName;
                try {
                    this._setLoading(true);
                    await this._gitService.fetchRemote(name);
                    vscode.window.showInformationMessage(t(locale, "fetchRemoteSuccess", { name }));
                    vscode.commands.executeCommand("git-wiz.refreshBranches");
                }
                catch (err: any) {
                    vscode.window.showErrorMessage(t(locale, "fetchRemoteError", { name, error: err.message }));
                }
                finally {
                    this._setLoading(false);
                }
                break;
            }
            case "settingsRemoveRemote": {
                const name = msg.remoteName;
                const confirm = await vscode.window.showWarningMessage(
                    t(locale, "removeRemoteConfirm", { name }),
                    { modal: true },
                    t(locale, "confirm"),
                );
                if (confirm !== t(locale, "confirm"))
                    break;

                try {
                    this._setLoading(true);
                    await this._gitService.removeRemote(name);
                    vscode.commands.executeCommand("git-wiz.refreshBranches");
                    webview.postMessage({ command: "settingsUpdateForm", remotes: await this._getUniqueRemotes() });
                }
                catch (err: any) {
                    vscode.window.showErrorMessage(t(locale, "removeRemoteError", { error: err.message }));
                }
                finally {
                    this._setLoading(false);
                }
                break;
            }
        }
    }
}
