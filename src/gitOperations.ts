import type { GitRunner } from "./git/GitRunner";
import type { GitCommit } from "./gitParser";
import { createSignature } from "./git/commitHighlight";
import { ChildProcessGitRunner } from "./git/GitRunner";
import { makeMsgEditorScript, makeSeqEditorScript } from "./git/rebaseScripts";
import { runRebaseWithScripts } from "./git/scriptedEditor";
import { parseGitLogOutput } from "./gitParser";

export type { GitCommit } from "./gitParser";

export interface Branch {
    name: string;
    fullName: string;
    isRemote: boolean;
    isHead: boolean;
    isTag: boolean;
}

export interface GitServiceOptions {
    cwd: string;
    runner?: GitRunner;
}

export class GitService {
    private readonly runner: GitRunner;
    private readonly cwd: string;

    constructor(options: GitServiceOptions) {
        this.cwd = options.cwd;
        this.runner = options.runner ?? new ChildProcessGitRunner(this.cwd);
    }

    getRunner(): GitRunner {
        return this.runner;
    }

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

    async getBranchCommits(branchName: string): Promise<Set<string>> {
        if (!branchName)
            return new Set();
        const result = await this.runner.exec(["rev-list", branchName], { maxBuffer: 50 * 1024 * 1024 });
        if (result.exitCode !== 0)
            return new Set();
        const hashes = new Set(result.stdout.split("\n").filter(Boolean));
        return hashes;
    }

    async getBranchCommitSignatures(branchName: string): Promise<Map<string, string[]>> {
        if (!branchName)
            return new Map();
        const result = await this.runner.exec(
            ["log", "--format=%ae\x1F%s\x1F%H", branchName],
            { maxBuffer: 50 * 1024 * 1024 },
        );
        if (result.exitCode !== 0)
            return new Map();
        const signatureMap = new Map<string, string[]>();
        result.stdout.split("\n")
            .filter(Boolean)
            .forEach((line) => {
                const [email, s, hash] = line.split("\x1F");
                const sig = createSignature(email, s);
                const hashes = signatureMap.get(sig) || [];
                hashes.push(hash);
                signatureMap.set(sig, hashes);
            });
        return signatureMap;
    }

    async getUnfilteredLog(
        filterBranch: string | null,
        skip = 0,
        limit = 200,
    ): Promise<GitCommit[]> {
        const args = ["log"];
        if (filterBranch) {
            args.push(filterBranch);
        }
        else {
            args.push("--branches", "--tags", "--remotes", "HEAD");
        }

        if (skip > 0) {
            args.push(`--skip=${skip}`);
        }
        args.push(`--max-count=${limit}`);
        args.push("--pretty=format:%H\x1F%h\x1F%P\x1F%an\x1F%ae\x1F%ai\x1F%D\x1F%ct\x1F%at\x1F%s");
        args.push("--date-order");

        const result = await this.runner.exec(args, { maxBuffer: 100 * 1024 * 1024 });
        if (result.exitCode !== 0) {
            return [];
        }
        return parseGitLogOutput(result.stdout.trim());
    }

    async getGitLog(
        filterBranch: string | null,
        skip = 0,
        limit = 200,
        filters?: { query?: string; author?: string; from?: string; to?: string },
        filePath?: string | null,
    ): Promise<GitCommit[]> {
        const args = ["log"];
        if (filterBranch) {
            args.push(filterBranch);
        }
        else {
            args.push("--branches", "--tags", "--remotes", "HEAD");
        }

        if (skip > 0) {
            args.push(`--skip=${skip}`);
        }
        args.push(`--max-count=${limit}`);

        if (filters?.query) {
            args.push(`--grep=${filters.query}`, "-i");
        }
        if (filters?.author) {
            args.push(`--author=${filters.author}`, "-i");
        }
        if (filters?.from) {
            args.push(`--since=${filters.from.replace(/\//g, "-")} 00:00:00`);
        }
        if (filters?.to) {
            args.push(`--until=${filters.to.replace(/\//g, "-")} 23:59:59`);
        }

        args.push("--pretty=format:%H\x1F%h\x1F%P\x1F%an\x1F%ae\x1F%ai\x1F%D\x1F%ct\x1F%at\x1F%s");
        args.push("--date-order");

        if (filePath) {
            args.push("--", filePath);
        }

        const promises: Promise<GitCommit[]>[] = [
            this.runner.exec(args, { maxBuffer: 100 * 1024 * 1024 }).then(res => (res.exitCode === 0 ? parseGitLogOutput(res.stdout.trim()) : [])),
        ];

        if (filters?.query && /^[a-f0-9]{4,40}$/i.test(filters.query) && skip === 0) {
            const hashArgs = ["log", "-1", filters.query, "--pretty=format:%H\x1F%h\x1F%P\x1F%an\x1F%ae\x1F%ai\x1F%D\x1F%ct\x1F%at\x1F%s"];
            promises.push(this.runner.exec(hashArgs).then(res => (res.exitCode === 0 ? parseGitLogOutput(res.stdout.trim()) : [])));
        }

        const results = await Promise.all(promises);
        const mainCommits = results[0];
        const hashCommits = results[1] || [];

        if (hashCommits.length > 0) {
            const hashCommit = hashCommits[0];
            if (!mainCommits.some(c => c.hash === hashCommit.hash)) {
                mainCommits.unshift(hashCommit);
            }
        }

        return mainCommits;
    }

    async cherryPickCommit(commitHash: string): Promise<void> {
        const result = await this.runner.exec(["cherry-pick", commitHash]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Cherry-pick failed with exit code ${result.exitCode}`);
        }
    }

    async revertCommit(commitHash: string): Promise<void> {
        const result = await this.runner.exec(["revert", commitHash, "--no-edit"]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Revert failed with exit code ${result.exitCode}`);
        }
    }

    async dropCommit(commitHash: string): Promise<void> {
        const result = await this.runner.exec(["rebase", "--onto", `${commitHash}^`, commitHash]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Drop failed with exit code ${result.exitCode}`);
        }
    }

    async resetToCommit(commitHash: string, type: string): Promise<void> {
        const result = await this.runner.exec(["reset", type, commitHash]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Reset failed with exit code ${result.exitCode}`);
        }
    }

    async squashCommits(hashes: string[], parentHash: string, newMessage: string): Promise<void> {
        const headHashResult = await this.runner.exec(["rev-parse", "HEAD"]);
        const headHash = headHashResult.exitCode === 0 ? headHashResult.stdout.trim() : "";

        if (hashes[0] === headHash) {
            const resetResult = await this.runner.exec(["reset", "--soft", parentHash]);
            if (resetResult.exitCode !== 0) {
                throw new Error(`Failed to reset: ${resetResult.stderr}`);
            }
            const commitResult = await this.runner.exec(["commit", "-m", newMessage]);
            if (commitResult.exitCode !== 0) {
                throw new Error(`Failed to commit squash: ${commitResult.stderr}`);
            }
        }
        else {
            const squashableHashes = hashes.slice(0, -1);
            const squashInProgress = await runRebaseWithScripts(this.cwd, parentHash, {
                seqScript: makeSeqEditorScript(squashableHashes.map(h => ({ hash: h, action: "squash" }))),
                msgScript: makeMsgEditorScript(`${newMessage}\n`),
            });

            if (!squashInProgress.success) {
                throw new Error(`Failed to squash: ${squashInProgress.error}`);
            }
        }
    }

    async revertCommits(hashes: string[]): Promise<void> {
        const result = await this.runner.exec(["revert", ...hashes, "--no-edit"]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Revert failed with exit code ${result.exitCode}`);
        }
    }

    async dropCommits(hashes: string[], parentHash: string): Promise<void> {
        const result = await this.runner.exec(["rebase", "--onto", parentHash, hashes[0]]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Drop failed with exit code ${result.exitCode}`);
        }
    }

    async cherryPickRange(hashes: string[]): Promise<void> {
        const ordered = [...hashes].reverse();
        const result = await this.runner.exec(["cherry-pick", ...ordered]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Cherry-pick failed with exit code ${result.exitCode}`);
        }
    }

    async mergeBranch(sourceBranch: string): Promise<{ success: boolean; error?: string; isConflict?: boolean }> {
        const result = await this.runner.exec(["merge", sourceBranch]);
        if (result.exitCode !== 0) {
            const isConflict = result.stderr.includes("CONFLICT") || result.stdout.includes("CONFLICT");
            return { success: false, error: result.stderr || result.stdout, isConflict };
        }
        return { success: true };
    }

    async abortMerge(): Promise<void> {
        await this.runner.exec(["merge", "--abort"]);
    }

    async rebaseBranch(targetBranch: string): Promise<void> {
        const result = await this.runner.exec(["rebase", targetBranch]);
        if (result.exitCode !== 0) {
            await this.runner.exec(["rebase", "--abort"]);
            throw new Error(`Rebase failed: ${result.stderr || result.stdout}. Rebase aborted.`);
        }
    }

    async createBranch(branchName: string, startPoint: string): Promise<void> {
        const result = await this.runner.exec(["branch", branchName, startPoint]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Failed to create branch with exit code ${result.exitCode}`);
        }
    }

    async checkoutBranch(branchName: string, options?: { track?: boolean; create?: boolean; startPoint?: string }): Promise<void> {
        const args = ["checkout"];
        if (options?.create)
            args.push("-b");
        if (options?.track)
            args.push("--track");
        args.push(branchName);
        if (options?.startPoint)
            args.push(options.startPoint);

        const result = await this.runner.exec(args);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Checkout failed with exit code ${result.exitCode}`);
        }
    }

    async fetch(options?: { all?: boolean; remote?: string }): Promise<void> {
        const args = ["fetch"];
        if (options?.all)
            args.push("--all");
        if (options?.remote)
            args.push(options.remote);

        const result = await this.runner.exec(args);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Fetch failed with exit code ${result.exitCode}`);
        }
    }

    async pull(): Promise<void> {
        const result = await this.runner.exec(["pull"]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || `Pull failed with exit code ${result.exitCode}`);
        }
    }

    async push(options?: { force?: boolean; setUpstream?: string }): Promise<void> {
        const args = ["push"];
        if (options?.force)
            args.push("--force-with-lease");
        if (options?.setUpstream) {
            args.push("-u", "origin", options.setUpstream);
        }

        const result = await this.runner.exec(args);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || result.stdout);
        }
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

    async getFileContentAtRev(hash: string, filePath: string): Promise<string> {
        const result = await this.runner.exec(["show", `${hash}:${filePath}`]);
        return result.exitCode === 0 ? result.stdout : "";
    }

    async getCommitFiles(hash: string): Promise<{ status: string; path: string; insertions?: number; deletions?: number }[]> {
        const nameStatusResult = await this.runner.exec(["diff-tree", "--no-commit-id", "--name-status", "-r", hash, "--root"]);
        if (nameStatusResult.exitCode !== 0) {
            throw new Error(`Failed to load commit files: ${nameStatusResult.stderr}`);
        }

        const output = nameStatusResult.stdout.trim();
        const statusMap = new Map<string, string>();

        if (output) {
            output.split("\n").filter(Boolean).forEach((line) => {
                const parts = line.split("\t");
                if (parts.length >= 2) {
                    const status = parts[0];
                    const path = parts[parts.length - 1];
                    statusMap.set(path, status.charAt(0));
                }
            });
        }

        const numstatResult = await this.runner.exec(["diff-tree", "--no-commit-id", "--numstat", "-r", hash, "--root"]);
        const numMap = new Map<string, { insertions: number; deletions: number }>();
        if (numstatResult.exitCode === 0) {
            const numLines = numstatResult.stdout.trim().split("\n").filter(Boolean);
            numLines.forEach((line) => {
                const parts = line.split("\t");
                if (parts.length >= 3) {
                    const ins = Number.parseInt(parts[0], 10) || 0;
                    const del = Number.parseInt(parts[1], 10) || 0;
                    const path = parts[parts.length - 1];
                    numMap.set(path, { insertions: ins, deletions: del });
                }
            });
        }

        if (statusMap.size === 0 && numMap.size > 0) {
            numMap.forEach((_, path) => statusMap.set(path, "A"));
        }

        return Array.from(statusMap.entries()).map(([path, status]) => {
            const stats = numMap.get(path);
            return {
                status,
                path,
                insertions: stats?.insertions,
                deletions: stats?.deletions,
            };
        });
    }

    async getGitConfig(key: string, scope: "local" | "global"): Promise<string> {
        const scopeArg = scope === "global" ? "--global" : "--local";
        const result = await this.runner.exec(["config", scopeArg, key]);
        return result.exitCode === 0 ? result.stdout.trim() : "";
    }

    async getNumstat(hash: string): Promise<{ added: number | null; deleted: number | null; path: string }[]> {
        const result = await this.runner.exec(["show", "--numstat", "--format=", hash]);
        if (result.exitCode !== 0) {
            return [];
        }
        return result.stdout.trim().split("\n").filter(Boolean).map((line) => {
            const parts = line.split("\t");
            if (parts.length >= 3) {
                return {
                    added: parts[0] === "-" ? null : Number.parseInt(parts[0], 10),
                    deleted: parts[1] === "-" ? null : Number.parseInt(parts[1], 10),
                    path: parts[2],
                };
            }
            const [added, deleted, ...pathParts] = line.trim().split(/\s+/);
            return {
                added: added === "-" ? null : Number.parseInt(added, 10),
                deleted: deleted === "-" ? null : Number.parseInt(deleted, 10),
                path: pathParts.join(" "),
            };
        });
    }

    async getPatchId(hash: string): Promise<string> {
        const show = await this.runner.exec(["show", hash]);
        if (show.exitCode !== 0)
            return "";

        const result = await this.runner.exec(["patch-id", "--stable"], { stdin: show.stdout });
        if (result.exitCode === 0) {
            return result.stdout.trim().split(" ")[0];
        }
        return "";
    }

    async getCommitFilePatchIds(hash: string): Promise<Map<string, string>> {
        const result = await this.runner.exec(["show", "--pretty=format:", hash]);
        if (result.exitCode !== 0)
            return new Map();

        const diffs = result.stdout.split(/^diff --git /m).filter(Boolean);
        const patchIds = new Map<string, string>();

        for (const diff of diffs) {
            const firstLine = diff.split("\n")[0];
            const parts = firstLine.split(" ");
            const bPath = parts[parts.length - 1];
            const filePath = bPath.startsWith("b/") ? bPath.substring(2) : bPath;

            const fullDiff = `diff --git ${diff}`;
            const pidResult = await this.runner.exec(["patch-id", "--stable"], { stdin: fullDiff });
            if (pidResult.exitCode === 0) {
                const pid = pidResult.stdout.trim().split(" ")[0];
                patchIds.set(filePath, pid);
            }
        }
        return patchIds;
    }

    async setGitConfig(key: string, value: string, scope: "local" | "global"): Promise<void> {
        const scopeArg = scope === "global" ? "--global" : "--local";
        await this.runner.exec(["config", scopeArg, key, value]);
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
        await this.runner.exec(["remote", "add", name, url]);
    }

    async removeRemote(name: string): Promise<void> {
        await this.runner.exec(["remote", "remove", name]);
    }

    async getUpstream(branchName: string): Promise<string | null> {
        const result = await this.runner.exec(["rev-parse", "--abbrev-ref", `${branchName}@{upstream}`]);
        return result.exitCode === 0 ? result.stdout.trim() : null;
    }
}
