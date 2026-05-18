import type { GitRunner } from "./GitRunner";
import { makeMsgEditorScript, makeSeqEditorScript } from "../utils/rebaseScripts";
import { runRebaseWithScripts } from "../utils/scriptedEditor";

export class WorkflowScribe {
    constructor(private readonly runner: GitRunner, private readonly cwd: string) { }

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

    async push(options?: { force?: boolean; setUpstream?: string; tags?: boolean; remote?: string; ref?: string }): Promise<void> {
        const args = ["push"];
        if (options?.force)
            args.push("--force-with-lease");
        if (options?.setUpstream) {
            args.push("-u", options.remote || "origin", options.setUpstream);
        }
        else if (options?.remote) {
            args.push(options.remote);
            if (options?.ref) {
                args.push(options.ref);
            }
        }
        if (options?.tags) {
            args.push("--tags");
        }

        const result = await this.runner.exec(args);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || result.stdout);
        }
    }

    async pushTag(remote: string, tagName: string): Promise<void> {
        const result = await this.runner.exec(["push", remote, tagName]);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || result.stdout);
        }
    }
}
