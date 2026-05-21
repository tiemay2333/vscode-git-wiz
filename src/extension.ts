import * as vscode from "vscode";
import { CommandManager } from "./commands/CommandManager";
import { GitWizContentProvider } from "./core/GitWizContentProvider";
import { DataManagerRegistry } from "./views/dataManager/DataManagerRegistry";
import { ViewDataManagerFactory } from "./views/dataManager/ViewDataManagerFactory";
import { GitGraphViewProvider } from "./views/GitGraphViewProvider";

export function activate(context: vscode.ExtensionContext) {
    const factory = new ViewDataManagerFactory();
    const registry = new DataManagerRegistry(factory);
    context.subscriptions.push(registry);

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(git-branch) Git Wiz";
    statusBarItem.tooltip = "Open Git Wiz Panel";
    statusBarItem.command = "workbench.view.extension.git-wiz";

    const updateStatusBar = () => {
        const config = vscode.workspace.getConfiguration();
        if (config.get("git-wiz.showStatusBarItem", true)) {
            statusBarItem.show();
        }
        else {
            statusBarItem.hide();
        }
    };

    updateStatusBar();
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("git-wiz.showStatusBarItem")) {
                updateStatusBar();
            }
        }),
    );

    const defaultCwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    const graphProvider = new GitGraphViewProvider(context.extensionUri, defaultCwd, registry);
    context.subscriptions.push(graphProvider);

    const commandManager = new CommandManager(registry, graphProvider, context.extensionUri);
    commandManager.registerAll(context);

    const contentProvider = new GitWizContentProvider(registry);
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("git-wiz", contentProvider));

    context.subscriptions.push(vscode.window.registerWebviewViewProvider(GitGraphViewProvider.viewType, graphProvider));
}

export function deactivate() { }
