import type { GitRunner } from "./GitRunner";

export class FileInspector {
    constructor(private readonly runner: GitRunner) { }

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
}
