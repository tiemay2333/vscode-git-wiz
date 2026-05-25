import type { GitRunner } from "./GitRunner";
import * as vscode from "vscode";
import { t } from "../../locale/i18n";

export interface Branch {
    name: string;
    fullName: string;
    isRemote: boolean;
    isHead: boolean;
    isTag: boolean;
}

export class RefManager {
    constructor(private readonly runner: GitRunner) { }

    async getBranches(): Promise<Branch[]> {
        const result = await this.runner.exec(["for-each-ref", "--format=%(refname)\x1F%(refname:short)\x1F%(HEAD)", "refs/heads/", "refs/remotes/", "refs/tags/"]);
        if (result.exitCode !== 0) {
            return [];
        }
        const branches = result.stdout
            .split("\n")
            .filter(line => line.trim())
            .map((line) => {
                const parts = line.split("\x1F");
                const refname = parts[0];
                const fullName = parts[1];
                const head = parts[2];

                const isRemote = refname.startsWith("refs/remotes/");
                const isTag = refname.startsWith("refs/tags/");
                if (isRemote && refname.endsWith("/HEAD")) {
                    return null;
                }

                const name = isTag ? fullName.substring(fullName.indexOf("/") + 1) : (isRemote ? fullName.substring(fullName.indexOf("/") + 1) : fullName);

                return {
                    name,
                    fullName,
                    isRemote,
                    isHead: head === "*",
                    isTag,
                };
            })
            .filter((b): b is Branch => b !== null);
        return branches;
    }

    async getCurrentBranch(): Promise<string | null> {
        const result = await this.runner.exec(["rev-parse", "--abbrev-ref", "HEAD"]);
        if (result.exitCode !== 0)
            return null;
        return result.stdout.trim();
    }

    async getHeadHash(branchName: string): Promise<string | null> {
        if (!branchName)
            return null;
        const result = await this.runner.exec(["rev-parse", branchName]);
        if (result.exitCode !== 0)
            return null;
        return result.stdout.trim();
    }

    async getUpstream(branchName: string): Promise<string | null> {
        const result = await this.runner.exec(["rev-parse", "--abbrev-ref", `${branchName}@{upstream}`]);
        return result.exitCode === 0 ? result.stdout.trim() : null;
    }

    async getRemotes(): Promise<{ name: string; url: string; type: "fetch" | "push" }[]> {
        const result = await this.runner.exec(["remote", "-v"]);
        if (result.exitCode !== 0)
            return [];
        const remotes: { name: string; url: string; type: "fetch" | "push" }[] = [];
        for (const line of result.stdout.split("\n").filter(Boolean)) {
            const parts = line.split(/\s+/);
            if (parts.length >= 3) {
                const type = parts[2] === "(push)" ? "push" as const : "fetch" as const;
                remotes.push({ name: parts[0], url: parts[1], type });
            }
        }
        return remotes;
    }

    async getUniqueRemotes(): Promise<{ name: string; url: string }[]> {
        const remotes = await this.getRemotes();
        const seen = new Set<string>();
        return remotes
            .filter((r) => {
                if (seen.has(r.name))
                    return false;
                seen.add(r.name);
                return true;
            })
            .map(({ name, url }) => ({ name, url }));
    }

    async addRemote(name: string, url: string): Promise<void> {
        let result = await this.runner.exec(["remote", "add", name, url]);

        // 自动判断未初始化的仓库，尝试 git init 后再添加
        if (result.exitCode !== 0 && result.stderr.toLowerCase().includes("not a git repository")) {
            const initResult = await this.runner.exec(["init"]);
            if (initResult.exitCode !== 0) {
                throw new Error(t(vscode.env.language, "initRepoFailed", { error: initResult.stderr }));
            }
            result = await this.runner.exec(["remote", "add", name, url]);
        }

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Failed to add remote ${name}`);
        }
        // 自动拉取新添加的远程仓库，不阻塞 addRemote 的结果
        this.fetchRemote(name).catch((err) => {
            console.error(t(vscode.env.language, "autoFetchFailed", { name }), err);
        });
    }

    async fetchRemote(remoteName?: string): Promise<void> {
        const args = ["fetch"];
        if (remoteName) {
            args.push(remoteName);
        }
        const result = await this.runner.exec(args);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Failed to fetch ${remoteName || "all"} with exit code ${result.exitCode}`);
        }
    }

    async removeRemote(name: string): Promise<void> {
        await this.runner.exec(["remote", "remove", name]);
    }

    async createTag(tagName: string, commitHash: string): Promise<void> {
        const result = await this.runner.exec(["tag", tagName, commitHash]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Failed to create tag with exit code ${result.exitCode}`);
        }
    }

    async deleteTag(tagName: string): Promise<void> {
        const result = await this.runner.exec(["tag", "-d", tagName]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Failed to delete tag with exit code ${result.exitCode}`);
        }
    }

    async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
        const result = await this.runner.exec(["branch", force ? "-D" : "-d", branchName]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || result.stdout);
        }
    }

    async deleteRemoteBranch(remote: string, branch: string): Promise<void> {
        const result = await this.runner.exec(["push", remote, "--delete", branch]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Failed to delete remote branch with exit code ${result.exitCode}`);
        }
    }
}
