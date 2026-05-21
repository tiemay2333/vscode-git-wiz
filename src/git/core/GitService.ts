import type { GitRunner } from "./GitRunner";
import { WorkflowScribe } from "@/git/core/WorkflowScribe";
import { ConfigManager } from "./ConfigManager";
import { FileInspector } from "./FileInspector";
import { ChildProcessGitRunner } from "./GitRunner";
import { LogEngine } from "./LogEngine";
import { RefManager } from "./RefManager";

export type { GitCommit } from "../utils/gitParser";
export type { Branch } from "./RefManager";

export interface GitServiceOptions {
    cwd: string;
    runner?: GitRunner;
}

/**
 * GitService 提供对 Git 仓库领域的深层访问。
 * 它按领域划分为 history, refs, ops, files, config 等子模块，
 * 提供了比扁平化委托更清晰的职责划分和更高的杠杆作用。
 */
export class GitService {
    private readonly runner: GitRunner;
    private readonly cwd: string;

    public readonly history: LogEngine;
    public readonly refs: RefManager;
    public readonly ops: WorkflowScribe;
    public readonly files: FileInspector;
    public readonly config: ConfigManager;

    constructor(options: GitServiceOptions) {
        this.cwd = options.cwd;
        this.runner = options.runner ?? new ChildProcessGitRunner(this.cwd);

        this.history = new LogEngine(this.runner);
        this.refs = new RefManager(this.runner);
        this.ops = new WorkflowScribe(this.runner, this.cwd);
        this.files = new FileInspector(this.runner);
        this.config = new ConfigManager(this.runner);
    }

    /**
     * 获取底层的 Git 执行器。
     */
    getRunner(): GitRunner {
        return this.runner;
    }
}
