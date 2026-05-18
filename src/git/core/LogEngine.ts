import type { GitCommit } from "../utils/gitParser";
import type { GitRunner } from "./GitRunner";
import { createSignature } from "@/git/highlight/commitHighlight";
import { parseGitLogOutput } from "../utils/gitParser";

export class LogEngine {
    constructor(private readonly runner: GitRunner) { }

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
}
