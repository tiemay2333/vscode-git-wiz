import type * as vscode from "vscode";
import type { DataManagerRegistry } from "@/views/dataManager/DataManagerRegistry";

export class GitWizContentProvider implements vscode.TextDocumentContentProvider {
    constructor(private readonly _registry: DataManagerRegistry) { }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        try {
            const params = new URLSearchParams(uri.query);
            const hash = params.get("hash");
            const fileParam = params.get("file");
            if (!hash) {
                return "";
            }
            const service = this._registry.getActiveManager()?.gitService;
            if (!service)
                return "";
            return await service.files.getFileContentAtRev(hash, fileParam || uri.path.substring(1));
        }
        catch {
            return "";
        }
    }
}
