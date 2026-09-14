import type { GitRunner } from "./GitRunner";
import * as path from "node:path";

export interface BlameLine {
    hash: string;
    line: number;
    author: string;
    email: string;
    /** Localized author date matching the commit date rendered in the graph panel. */
    date: string;
    /** Localized author date without a time component for editor annotations. */
    dateOnly?: string;
    commitTime: string;
    summary: string;
    message: string;
}

export interface BlameResult {
    cwd: string;
    gitDirs: string[];
    lines: BlameLine[];
}

export function parseBlame(output: string): BlameLine[] {
    const lines: BlameLine[] = [];
    let current: BlameLine | undefined;
    for (const line of output.split("\n")) {
        const header = /^([\da-f]{40,64}) \d+ (\d+)(?: \d+)?$/.exec(line);
        if (header) {
            current = { hash: header[1], line: Number(header[2]) - 1, author: "", email: "", date: "", dateOnly: "", commitTime: "", summary: "", message: "" };
        }
        else if (current) {
            if (line.startsWith("author ")) {
                current.author = line.slice(7);
            }
            else if (line.startsWith("author-mail ")) {
                current.email = line.slice(12).replace(/^<|>$/g, "");
            }
            else if (line.startsWith("author-time ")) {
                // The commit panel displays Git's author date (`%ai`), so blame
                // annotations must use the author timestamp as well.
                const authorDate = new Date(Number(line.slice(12)) * 1000);
                current.date = authorDate.toLocaleString();
                current.dateOnly = authorDate.toLocaleDateString();
            }
            else if (line.startsWith("committer-time ")) {
                current.commitTime = new Date(Number(line.slice(15)) * 1000).toISOString();
            }
            else if (line.startsWith("summary ")) {
                current.summary = line.slice(8);
            }
            else if (line.startsWith("\t")) {
                lines.push(current);
                current = undefined;
            }
        }
    }
    return lines;
}

export class BlameService {
    constructor(private readonly runner: GitRunner) { }

    async getBlame(filePath: string, contents: string): Promise<BlameResult | undefined> {
        const directory = path.dirname(filePath);
        const root = await this.runner.exec(["rev-parse", "--show-toplevel", "--show-prefix", "--absolute-git-dir", "--git-common-dir"], { cwd: directory, trimOutput: false });
        if (root.exitCode !== 0)
            return undefined;
        const [cwd, prefix, gitDir, commonDir] = root.stdout.split("\n");
        // Git's prefix respects symlinks and nested repositories; path.relative may not.
        const relativePath = path.posix.join(prefix, path.basename(filePath));
        const gitDirs = [...new Set([gitDir, path.resolve(directory, commonDir)])];
        const head = await this.runner.exec(["cat-file", "-e", `HEAD:${relativePath}`], { cwd });
        if (head.exitCode !== 0) {
            const count = contents ? contents.split("\n").length - (contents.endsWith("\n") ? 1 : 0) : 0;
            return {
                cwd,
                gitDirs,
                lines: Array.from({ length: count }, (_, line) => ({
                    hash: "0".repeat(40),
                    line,
                    author: "",
                    email: "",
                    date: "",
                    dateOnly: "",
                    commitTime: "",
                    summary: "",
                    message: "",
                })),
            };
        }
        const result = await this.runner.exec(["blame", "--line-porcelain", "--contents", "-", "--", relativePath], {
            cwd,
            stdin: contents,
            trimOutput: false,
            maxBuffer: 50 * 1024 * 1024,
        });
        if (result.exitCode !== 0)
            throw new Error(result.stderr || "Git blame failed");
        const lines = parseBlame(result.stdout);
        const hashes = [...new Set(lines.map(line => line.hash).filter(hash => !/^0+$/.test(hash)))];
        if (hashes.length) {
            // Fetch full messages once per file, rather than once per annotated line.
            const log = await this.runner.exec(["log", "--no-walk", "--format=%H%x00%B%x00", "--stdin"], {
                cwd,
                stdin: `${hashes.join("\n")}\n`,
                trimOutput: false,
                maxBuffer: 50 * 1024 * 1024,
            });
            if (log.exitCode !== 0)
                throw new Error(log.stderr || "Git commit log failed");
            const fields = log.stdout.split("\0");
            const messages = new Map<string, string>();
            for (let i = 0; i + 1 < fields.length; i += 2)
                messages.set(fields[i].trim(), fields[i + 1].trimEnd());
            for (const line of lines)
                line.message = messages.get(line.hash) ?? "";
        }
        return { cwd, gitDirs, lines };
    }
}
