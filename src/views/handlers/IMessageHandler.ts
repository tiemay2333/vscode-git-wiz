import type * as vscode from "vscode";
import type { FromWebviewMessage } from "../types/WebviewProtocol";

/**
 * Interface for webview message handlers.
 */
export interface IMessageHandler extends vscode.Disposable {
    /**
     * List of commands handled by this handler.
     */
    readonly commands: FromWebviewMessage["command"][];

    /**
     * Optional list of commands that should be handled immediately (not queued).
     */
    readonly immediateCommands?: FromWebviewMessage["command"][];

    /**
     * Handle the webview message.
     */
    handle: (message: FromWebviewMessage, webview: vscode.Webview) => Promise<void> | void;
}
