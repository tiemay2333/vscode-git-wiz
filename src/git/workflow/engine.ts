import type { BaseWorkflow, WorkflowContext } from "./base";
import type { UIService } from "./uiservice";
import type { GitService } from "@/git/core/GitService";
import * as vscode from "vscode";
import { t } from "@/locale/i18n";
import { VSCodeUIService } from "./vscode-ui";

/**
 * GitWorkflowEngine 负责调度和执行工作流。
 * 它实现了并发锁机制，防止多个 Git 修改操作同时进行。
 */
export class GitWorkflowEngine {
    private _isLocked = false;
    private readonly _ui: UIService;

    constructor(
        private readonly _git: GitService,
        private readonly _refresh: () => void,
        ui?: UIService,
    ) {
        this._ui = ui ?? new VSCodeUIService();
    }

    /**
     * 执行指定的工作流。
     */
    async execute<T>(workflow: BaseWorkflow<T>): Promise<T | undefined> {
        const locale = vscode.env.language;
        if (this._isLocked) {
            this._ui.notify(t(locale, "lockedWarning"), "warning");
            return undefined;
        }

        this._isLocked = true;
        const context: WorkflowContext = {
            git: this._git,
            ui: this._ui,
            refresh: this._refresh,
            locale,
        };

        try {
            return await workflow.run(context);
        }
        catch (error: any) {
            const errorMsg = error.message || t(locale, "operationFailed", { error: workflow.label });
            this._ui.notify(errorMsg, "error");
            return undefined;
        }
        finally {
            this._isLocked = false;
        }
    }

    get ui(): UIService {
        return this._ui;
    }
}
