import type * as vscode from "vscode";
import type { IMessageHandler } from "./handlers";
import type { FromWebviewMessage } from "./types/WebviewProtocol";

export class MessageDispatcher implements vscode.Disposable {
    private readonly _handlers = new Map<string, IMessageHandler>();
    private readonly _immediateCommands = new Set<string>();
    private _messageQueue = Promise.resolve();

    /**
     * Registers a handler for its supported commands.
     */
    public register(handler: IMessageHandler): void {
        handler.commands.forEach((cmd) => {
            if (this._handlers.has(cmd)) {
                console.warn(`[MessageDispatcher] Overwriting handler for command: ${cmd}`);
            }
            this._handlers.set(cmd, handler);
        });

        handler.immediateCommands?.forEach((cmd) => {
            this._immediateCommands.add(cmd);
        });
    }

    /**
     * Dispatches a message to the appropriate handler.
     */
    public async dispatch(message: FromWebviewMessage, webview: vscode.Webview): Promise<void> {
        const cmd = message.command;
        const handler = this._handlers.get(cmd);

        if (!handler) {
            console.warn(`[MessageDispatcher] No handler registered for command: ${cmd}`);
            return;
        }

        if (this._immediateCommands.has(cmd)) {
            try {
                await handler.handle(message, webview);
            }
            catch (error) {
                this._handleError(cmd, error);
            }
            return;
        }

        // Queue async operations
        this._messageQueue = this._messageQueue.then(async () => {
            try {
                await handler.handle(message, webview);
            }
            catch (error) {
                this._handleError(cmd, error);
            }
        });

        await this._messageQueue;
    }

    private _handleError(cmd: string, error: any): void {
        console.error(`[MessageDispatcher] Error handling command '${cmd}':`, error);
        // We only show error message here if the handler itself didn't catch it
        // Most handlers already have their own try-catch and UI feedback
    }

    public dispose(): void {
        this._handlers.clear();
        this._immediateCommands.clear();
    }
}
