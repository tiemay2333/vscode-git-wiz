import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as process from "node:process";

export interface RebaseScripts {
    seqScript: string;
    msgScript: string;
}

export interface RebaseResult {
    success: boolean;
    error?: string;
}

/**
 * Runs a git interactive rebase with custom GIT_SEQUENCE_EDITOR and GIT_EDITOR scripts.
 *
 * Writes the scripts to temp files, runs `git rebase -i <baseCommit>`, then cleans up.
 * If the rebase fails, runs `git rebase --abort`.
 */
export function runRebaseWithScripts(
    cwd: string,
    baseCommit: string,
    scripts: RebaseScripts,
): Promise<RebaseResult> {
    return new Promise((resolve) => {
        const tmpDir = os.tmpdir();
        const seqEditorPath = path.join(tmpDir, "git-wiz-seq-editor.js");
        const msgEditorPath = path.join(tmpDir, "git-wiz-msg-editor.js");

        fs.writeFileSync(seqEditorPath, scripts.seqScript);
        fs.writeFileSync(msgEditorPath, scripts.msgScript);

        const env = {
            ...process.env,
            GIT_SEQUENCE_EDITOR: `node "${seqEditorPath}"`,
            GIT_EDITOR: `node "${msgEditorPath}"`,
        };

        cp.exec(`git rebase -i ${baseCommit}`, { cwd, env }, (error, _stdout, stderr) => {
            // Cleanup temp files regardless of outcome
            try {
                fs.rmSync(seqEditorPath, { force: true });
            }
            catch {
                /* ignore */
            }
            try {
                fs.rmSync(msgEditorPath, { force: true });
            }
            catch {
                /* ignore */
            }

            if (error) {
                // Attempt to abort, but don't block on it
                cp.exec("git rebase --abort", { cwd }, () => {
                    resolve({ success: false, error: `${error.message}\n${stderr}` });
                });
            }
            else {
                resolve({ success: true });
            }
        });
    });
}
