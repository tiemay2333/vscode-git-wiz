import type * as vscode from "vscode";

export interface ICommandGroup {
    register: (context: vscode.ExtensionContext) => void;
}
