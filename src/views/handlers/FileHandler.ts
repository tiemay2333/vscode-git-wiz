import type { IMessageHandler } from "./IMessageHandler";
import type { FromWebviewMessage } from "@/views/types/WebviewProtocol";
import * as vscode from "vscode";

export class FileHandler implements IMessageHandler {
    readonly commands: FromWebviewMessage["command"][] = [
        "openDiff",
        "openFile",
    ];

    constructor() { }

    dispose(): void {
        // No resources to manage
    }

    handle(msg: FromWebviewMessage): void {
        switch (msg.command) {
            case "openDiff":
                this._openDiff(msg.commitHash, msg.filePath, msg.parentHash);
                break;
            case "openFile":
                this._openFile(msg.filePath);
                break;
        }
    }

    private _openDiff(commitHash: string, filePath: string, parentHash?: string): void {
        const shortCommit = commitHash.substring(0, 7);
        const diffParent = parentHash || `${commitHash}~1`;
        const shortParent = parentHash ? parentHash.substring(0, 7) : `${shortCommit}~1`;

        const fileName = filePath.split("/").pop() || filePath;

        const uri1 = vscode.Uri.parse(`git-wiz:/${shortParent}/${fileName}?hash=${diffParent}&file=${encodeURIComponent(filePath)}`);
        const uri2 = vscode.Uri.parse(`git-wiz:/${shortCommit}/${fileName}?hash=${commitHash}&file=${encodeURIComponent(filePath)}`);

        const title = `${fileName} (${shortParent} ↔ ${shortCommit})`;
        vscode.commands.executeCommand("vscode.diff", uri1, uri2, title);
    }

    private _openFile(filePath: string): void {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!cwd) {
            return;
        }
        vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(vscode.Uri.joinPath(vscode.Uri.file(cwd), filePath).fsPath),
        );
    }
}
