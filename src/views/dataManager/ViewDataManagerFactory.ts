import type { IViewDataManager } from "./IViewDataManager";
import { GitService } from "@/git/core/GitService";
import { AsyncHighlightVerifier } from "@/git/highlight/AsyncHighlightVerifier";
import { GitWorkflowEngine } from "@/git/workflow/engine";
import { VSCodeUIService } from "@/git/workflow/vscode-ui";
import { ViewDataManager } from "../ViewDataManager";

/**
 * 负责组装 ViewDataManager 及其复杂依赖链的工厂类
 */
export class ViewDataManagerFactory {
    public create(cwd: string, onUpdateLoading: (visible: boolean) => void, onUpdateHighlight: (hash: string, status: string) => void): IViewDataManager {
        const gitService = new GitService({ cwd });

        // 每个仓库独立的 UI Service，用于处理进度条和通知
        const uiService = new VSCodeUIService(onUpdateLoading);

        const workflowEngine = new GitWorkflowEngine(
            gitService,
            () => { /* refreshAll will be wired later by Registry */ },
            uiService,
        );

        const verifier = new AsyncHighlightVerifier(gitService, onUpdateHighlight);

        return new ViewDataManager(cwd, gitService, workflowEngine, verifier);
    }
}
