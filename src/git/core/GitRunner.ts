import * as cp from "node:child_process";

export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface GitRunner {
    exec: (args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv; maxBuffer?: number; stdin?: string }) => Promise<ExecResult>;
}

export class ChildProcessGitRunner implements GitRunner {
    constructor(private defaultCwd?: string) {}

    exec(args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv; maxBuffer?: number; stdin?: string }): Promise<ExecResult> {
        return new Promise((resolve) => {
            const child = cp.execFile("git", args, {
                cwd: options?.cwd ?? this.defaultCwd,
                env: options?.env,
                maxBuffer: options?.maxBuffer ?? 10 * 1024 * 1024,
            }, (error, stdout, stderr) => {
                resolve({
                    stdout: (stdout ?? "").trim(),
                    stderr: (stderr ?? "").trim(),
                    exitCode: typeof error?.code === "number" ? error.code : error ? 1 : 0,
                });
            });

            if (options?.stdin) {
                child.stdin?.write(options.stdin);
                child.stdin?.end();
            }
        });
    }
}
