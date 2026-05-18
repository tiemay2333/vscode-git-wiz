import type { UIService } from "./uiservice";
import type { GitService } from "@/git/core/GitService";

/**
 * WorkflowContext 包含了工作流执行时所需的所有依赖。
 */
export interface WorkflowContext {
    git: GitService;
    ui: UIService;
    refresh: () => void;
    locale: string;
}

/**
 * BaseWorkflow 是所有 Git 工作流的抽象基类。
 * 它定义了执行的标准流程，并提供了对 GitService 和 UIService 的访问。
 */
export abstract class BaseWorkflow<T = void> {
    abstract readonly id: string;
    abstract readonly label: string;

    /**
     * 执行工作流的主入口。
     */
    abstract run(context: WorkflowContext): Promise<T>;
}
