import { GitService } from "../../gitOperations";
import { BaseWorkflow, WorkflowContext } from "./base";
import { UIService } from "./uiservice";
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
        ui?: UIService
    ) {
        this._ui = ui ?? new VSCodeUIService();
    }

    /**
     * 执行指定的工作流。
     */
    async execute<T>(workflow: BaseWorkflow<T>): Promise<T | undefined> {
        if (this._isLocked) {
            this._ui.notify("另一个 Git 操作正在进行中，请稍后再试。", "warning");
            return undefined;
        }

        this._isLocked = true;
        const context: WorkflowContext = {
            git: this._git,
            ui: this._ui,
            refresh: this._refresh
        };

        try {
            return await workflow.run(context);
        } catch (error: any) {
            this._ui.notify(error.message || `工作流 "${workflow.label}" 执行失败`, "error");
            return undefined;
        } finally {
            this._isLocked = false;
        }
    }

    get ui(): UIService {
        return this._ui;
    }
}
