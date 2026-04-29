interface VscodeApi {
    postMessage(message: unknown): void;
    getState<T>(): T | undefined;
    setState<T>(state: T): void;
}

declare global {
    function acquireVsCodeApi(): VscodeApi;
}

// acquireVsCodeApi can only be called once per webview context
export const vscode = acquireVsCodeApi();
