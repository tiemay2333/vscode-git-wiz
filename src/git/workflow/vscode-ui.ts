import * as vscode from "vscode";
import { UIService } from "./uiservice";

/**
 * VSCodeUIService 是 UIService 的 VSCode 实现。
 */
export class VSCodeUIService implements UIService {
    async confirm(message: string, options?: string[] | { modal?: boolean; detail?: string }, ...items: string[]): Promise<string | undefined> {
        if (Array.isArray(options)) {
            return await vscode.window.showWarningMessage(message, ...options);
        } else if (options && typeof options === "object") {
            return await vscode.window.showWarningMessage(message, options, ...items);
        } else {
            return await vscode.window.showWarningMessage(message, ...items);
        }
    }

    async showProgress<T>(title: string, task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>): Promise<T> {
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title,
            cancellable: false
        }, (progress) => task(progress));
    }

    notify(message: string, type: "info" | "warning" | "error"): void {
        switch (type) {
            case "info":
                vscode.window.showInformationMessage(message);
                break;
            case "warning":
                vscode.window.showWarningMessage(message);
                break;
            case "error":
                vscode.window.showErrorMessage(message);
                break;
        }
    }

    async showInputBox(options?: vscode.InputBoxOptions): Promise<string | undefined> {
        return await vscode.window.showInputBox(options);
    }

    async showQuickPick<T extends vscode.QuickPickItem>(items: T[] | Promise<T[]>, options?: vscode.QuickPickOptions): Promise<T | undefined> {
        return await vscode.window.showQuickPick(items, options);
    }
}
