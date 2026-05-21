import type * as vscode from "vscode";
import type { ToWebviewMessage } from "./types/WebviewProtocol";

/**
 * WebviewMessenger 负责 Webview 消息通信。
 * 通过 ToWebviewMessage 强类型约束发送的消息。
 */
export class WebviewMessenger {
    private _view?: vscode.WebviewView;
    private _panel?: vscode.WebviewPanel;

    constructor() {}

    public setView(view: vscode.WebviewView) {
        this._view = view;
    }

    public setPanel(panel: vscode.WebviewPanel) {
        this._panel = panel;
    }

    public postMessage(message: ToWebviewMessage): void {
        this._view?.webview.postMessage(message);
        this._panel?.webview.postMessage(message);
    }

    public get view(): vscode.WebviewView | undefined {
        return this._view;
    }

    public get panel(): vscode.WebviewPanel | undefined {
        return this._panel;
    }

    public get webview(): vscode.Webview | undefined {
        return this._view?.webview || this._panel?.webview;
    }

    public get isVisible(): boolean {
        return (this._view && this._view.visible) || (this._panel && this._panel.visible) || false;
    }
}
