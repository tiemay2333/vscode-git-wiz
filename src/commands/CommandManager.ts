import type * as vscode from "vscode";
import type { ICommandGroup } from "./ICommandGroup";
import type { DataManagerRegistry } from "@/views/dataManager/DataManagerRegistry";
import type { GitGraphViewProvider } from "@/views/GitGraphViewProvider";
import { GitCommandGroup } from "./GitCommandGroup";
import { ViewCommandGroup } from "./ViewCommandGroup";

export class CommandManager implements vscode.Disposable {
    private readonly _commandGroups: ICommandGroup[];

    constructor(
        registry: DataManagerRegistry,
        graphProvider: GitGraphViewProvider,
        extensionUri: vscode.Uri,
    ) {
        this._commandGroups = [
            new GitCommandGroup(graphProvider),
            new ViewCommandGroup(registry, graphProvider, extensionUri),
        ];
    }

    public registerAll(context: vscode.ExtensionContext): void {
        for (const group of this._commandGroups) {
            group.register(context);
        }
    }

    public dispose(): void {
        // Individual command registrations are handled by context.subscriptions
    }
}
