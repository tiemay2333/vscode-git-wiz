import type { GitCommit } from "../utils/gitParser";
import type { GitRunner } from "./GitRunner";
import type { Branch } from "./RefManager";
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

export class GitService {
    private readonly runner: GitRunner;
    private readonly cwd: string;

    private readonly logEngine: LogEngine;
    private readonly refManager: RefManager;
    private readonly workflowScribe: WorkflowScribe;
    private readonly fileInspector: FileInspector;
    private readonly configManager: ConfigManager;

    constructor(options: GitServiceOptions) {
        this.cwd = options.cwd;
        this.runner = options.runner ?? new ChildProcessGitRunner(this.cwd);

        this.logEngine = new LogEngine(this.runner);
        this.refManager = new RefManager(this.runner);
        this.workflowScribe = new WorkflowScribe(this.runner, this.cwd);
        this.fileInspector = new FileInspector(this.runner);
        this.configManager = new ConfigManager(this.runner);
    }

    getRunner(): GitRunner {
        return this.runner;
    }

    // --- RefManager Delegates ---

    async getBranches(): Promise<Branch[]> {
        return this.refManager.getBranches();
    }

    async getCurrentBranch(): Promise<string | null> {
        return this.refManager.getCurrentBranch();
    }

    async getHeadHash(branchName: string): Promise<string | null> {
        return this.refManager.getHeadHash(branchName);
    }

    async getUpstream(branchName: string): Promise<string | null> {
        return this.refManager.getUpstream(branchName);
    }

    async getRemotes(): Promise<{ name: string; url: string; type: "fetch" | "push" }[]> {
        return this.refManager.getRemotes();
    }

    async getUniqueRemotes(): Promise<{ name: string; url: string }[]> {
        return this.refManager.getUniqueRemotes();
    }

    async addRemote(name: string, url: string): Promise<void> {
        return this.refManager.addRemote(name, url);
    }

    async removeRemote(name: string): Promise<void> {
        return this.refManager.removeRemote(name);
    }

    async createTag(tagName: string, commitHash: string): Promise<void> {
        return this.refManager.createTag(tagName, commitHash);
    }

    async deleteTag(tagName: string): Promise<void> {
        return this.refManager.deleteTag(tagName);
    }

    async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
        return this.refManager.deleteBranch(branchName, force);
    }

    async deleteRemoteBranch(remote: string, branch: string): Promise<void> {
        return this.refManager.deleteRemoteBranch(remote, branch);
    }

    // --- LogEngine Delegates ---

    async getBranchCommits(branchName: string): Promise<Set<string>> {
        return this.logEngine.getBranchCommits(branchName);
    }

    async getBranchCommitSignatures(branchName: string): Promise<Map<string, string[]>> {
        return this.logEngine.getBranchCommitSignatures(branchName);
    }

    async getUnfilteredLog(filterBranch: string | null, skip = 0, limit = 200): Promise<GitCommit[]> {
        return this.logEngine.getUnfilteredLog(filterBranch, skip, limit);
    }

    async getGitLog(
        filterBranch: string | null,
        skip = 0,
        limit = 200,
        filters?: { query?: string; author?: string; from?: string; to?: string },
        filePath?: string | null,
    ): Promise<GitCommit[]> {
        return this.logEngine.getGitLog(filterBranch, skip, limit, filters, filePath);
    }

    async getPatchId(hash: string): Promise<string> {
        return this.logEngine.getPatchId(hash);
    }

    async getCommitFilePatchIds(hash: string): Promise<Map<string, string>> {
        return this.logEngine.getCommitFilePatchIds(hash);
    }

    // --- WorkflowScribe Delegates ---

    async cherryPickCommit(commitHash: string): Promise<void> {
        return this.workflowScribe.cherryPickCommit(commitHash);
    }

    async revertCommit(commitHash: string): Promise<void> {
        return this.workflowScribe.revertCommit(commitHash);
    }

    async dropCommit(commitHash: string): Promise<void> {
        return this.workflowScribe.dropCommit(commitHash);
    }

    async resetToCommit(commitHash: string, type: string): Promise<void> {
        return this.workflowScribe.resetToCommit(commitHash, type);
    }

    async squashCommits(hashes: string[], parentHash: string, newMessage: string): Promise<void> {
        return this.workflowScribe.squashCommits(hashes, parentHash, newMessage);
    }

    async revertCommits(hashes: string[]): Promise<void> {
        return this.workflowScribe.revertCommits(hashes);
    }

    async dropCommits(hashes: string[], parentHash: string): Promise<void> {
        return this.workflowScribe.dropCommits(hashes, parentHash);
    }

    async cherryPickRange(hashes: string[]): Promise<void> {
        return this.workflowScribe.cherryPickRange(hashes);
    }

    async mergeBranch(sourceBranch: string): Promise<{ success: boolean; error?: string; isConflict?: boolean }> {
        return this.workflowScribe.mergeBranch(sourceBranch);
    }

    async abortMerge(): Promise<void> {
        return this.workflowScribe.abortMerge();
    }

    async rebaseBranch(targetBranch: string): Promise<void> {
        return this.workflowScribe.rebaseBranch(targetBranch);
    }

    async createBranch(branchName: string, startPoint: string): Promise<void> {
        return this.workflowScribe.createBranch(branchName, startPoint);
    }

    async checkoutBranch(branchName: string, options?: { track?: boolean; create?: boolean; startPoint?: string }): Promise<void> {
        return this.workflowScribe.checkoutBranch(branchName, options);
    }

    async fetch(options?: { all?: boolean; remote?: string }): Promise<void> {
        return this.workflowScribe.fetch(options);
    }

    async pull(): Promise<void> {
        return this.workflowScribe.pull();
    }

    async push(options?: { force?: boolean; setUpstream?: string; tags?: boolean; remote?: string; ref?: string }): Promise<void> {
        return this.workflowScribe.push(options);
    }

    async pushTag(remote: string, tagName: string): Promise<void> {
        return this.workflowScribe.pushTag(remote, tagName);
    }

    // --- FileInspector Delegates ---

    async getFileContentAtRev(hash: string, filePath: string): Promise<string> {
        return this.fileInspector.getFileContentAtRev(hash, filePath);
    }

    async getCommitFiles(hash: string): Promise<{ status: string; path: string; insertions?: number; deletions?: number }[]> {
        return this.fileInspector.getCommitFiles(hash);
    }

    async getNumstat(hash: string): Promise<{ added: number | null; deleted: number | null; path: string }[]> {
        return this.fileInspector.getNumstat(hash);
    }

    // --- ConfigManager Delegates ---

    async getGitConfig(key: string, scope: "local" | "global"): Promise<string> {
        return this.configManager.getGitConfig(key, scope);
    }

    async setGitConfig(key: string, value: string, scope: "local" | "global"): Promise<void> {
        return this.configManager.setGitConfig(key, value, scope);
    }
}
