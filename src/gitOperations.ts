import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { parseGitLogOutput, type GitCommit } from './gitParser';

export type { GitCommit } from './gitParser';

export interface Branch {
    name: string;
    fullName: string;
    isRemote: boolean;
    isHead: boolean;
    isTag: boolean;
}

export class GitOperations {
    constructor(private readonly onRefresh: () => void) {}

    private getCwd(): string | null {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    }

    async getBranches(): Promise<Branch[]> {
        return new Promise((resolve) => {
            const cwd = this.getCwd();
            if (!cwd) {
                resolve([]);
                return;
            }
            cp.exec('git for-each-ref --format="%(refname)|%(refname:short)|%(HEAD)" refs/heads/ refs/remotes/ refs/tags/', { cwd }, (err, stdout) => {
                if (err) {
                    resolve([]);
                    return;
                }
                const branches: Branch[] = stdout
                    .split('\n')
                    .filter((line) => line.trim())
                    .map((line) => {
                        const parts = line.split('|');
                        const refname = parts[0];
                        const fullName = parts[1];
                        const head = parts[2];

                        const isRemote = refname.startsWith('refs/remotes/');
                        const isTag = refname.startsWith('refs/tags/');
                        if (isRemote && refname.endsWith('/HEAD')) {
                            return null as any;
                        }

                        const name = isTag ? fullName.substring(fullName.indexOf('/') + 1) : (isRemote ? fullName.substring(fullName.indexOf('/') + 1) : fullName);

                        return {
                            name,
                            fullName,
                            isRemote,
                            isHead: head === '*',
                            isTag,
                        };
                    })
                    .filter(b => b !== null);
                resolve(branches);
            });
        });
    }

    async getCurrentBranch(): Promise<string | null> {
        return new Promise((resolve) => {
            const cwd = this.getCwd();
            if (!cwd) return resolve(null);
            cp.exec('git rev-parse --abbrev-ref HEAD', { cwd }, (err, stdout) => {
                if (err) return resolve(null);
                resolve(stdout.trim());
            });
        });
    }

    async getGitLog(
        filterBranch: string | null,
        skip = 0,
        limit = 200,
        filters?: { query?: string; author?: string; from?: string; to?: string },
        filePath?: string | null,
    ): Promise<GitCommit[]> {
        return new Promise((resolve) => {
            const cwd = this.getCwd();
            if (!cwd) {
                resolve([]);
                return;
            }

            const branchArg = filterBranch ? ` ${filterBranch}` : ' --all';
            const skipArg = skip > 0 ? ` --skip=${skip}` : '';
            
            let filterArgs = '';
            if (filters?.query) {
                const escapedQuery = filters.query.replace(/"/g, '\\"');
                // To search both commit message (--grep) and diff contents (-G), using -G or --grep.
                // Since "全部内容" can mean message or file content, let's use --grep and -G 
                // But combining them is an AND. We can't OR them easily.
                // We'll use --grep to search commit messages, which is standard. For "全部内容", maybe just simple grep is intended, but we use -i for case-insensitive.
                filterArgs += ` --grep="${escapedQuery}" -i`;
            }
            if (filters?.author) {
                filterArgs += ` --author="${filters.author.replace(/"/g, '\\"')}" -i`;
            }
            if (filters?.from) {
                filterArgs += ` --since="${filters.from}"`;
            }
            if (filters?.to) {
                filterArgs += ` --until="${filters.to} 23:59:59"`;
            }

            const fileArg = filePath ? ` -- "${filePath}"` : '';
            const gitCommand = `git log${branchArg}${skipArg} --max-count=${limit}${filterArgs} --pretty=format:"%H|%h|%P|%an|%ae|%ai|%D|%ct|%s" --date-order${fileArg}`;

            const runCommand = (cmd: string): Promise<string> => {
                return new Promise((res) => {
                    cp.exec(cmd, { cwd, maxBuffer: 100 * 1024 * 1024 }, (error, stdout) => {
                        res(error ? '' : stdout.trim());
                    });
                });
            };

            const promises: Promise<string>[] = [runCommand(gitCommand)];

            if (filters?.query && /^[a-fA-F0-9]{4,40}$/.test(filters.query) && skip === 0) {
                // If query looks like a hash and we are on the first page, try fetching it directly
                // in case it's a commit hash. By using git log -1 it will silently fail if not found.
                const hashCommand = `git log -1 ${filters.query} --pretty=format:"%H|%h|%P|%an|%ae|%ai|%D|%ct|%s"`;
                promises.push(runCommand(hashCommand));
            }

            Promise.all(promises).then((results) => {
                const stdoutMain = results[0];
                const stdoutHash = results[1] || '';

                // Combine results, ensuring no duplicates by checking full hash (the first part of the line)
                const lines = stdoutMain ? stdoutMain.split('\n') : [];
                if (stdoutHash) {
                    const hashLineHash = stdoutHash.split('|')[0];
                    if (!lines.some((line) => line.startsWith(hashLineHash + '|'))) {
                        lines.unshift(stdoutHash);
                    }
                }

                const commits = parseGitLogOutput(lines.join('\n'));
                resolve(commits);
            });
        });
    }

    async editCommitMessage(commitHash: string, newMessage?: string) {
        if (!newMessage) {
            return;
        }
        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        const headHash = await new Promise<string>((resolve) => {
            cp.exec('git rev-parse HEAD', { cwd }, (err, stdout) => resolve(err ? '' : stdout.trim()));
        });

        const escaped = newMessage.replace(/"/g, '\\"');

        if (commitHash === headHash) {
            cp.exec(`git commit --amend -m "${escaped}"`, { cwd }, (error) => {
                if (error) {
                    vscode.window.showErrorMessage(`Failed to edit commit message: ${error.message}`);
                    return;
                }
                vscode.window.showInformationMessage('Commit message updated successfully');
                this.onRefresh();
            });
        } else {
            const seqEditorScript = `
const fs = require('fs');
const file = process.argv[2];
const targetHash = ${JSON.stringify(commitHash)};
const lines = fs.readFileSync(file, 'utf8').split('\\n');
const result = lines.map(line => {
    const parts = line.trim().split(/\\s+/);
    if ((parts[0] === 'pick' || parts[0] === 'p') && parts[1] && targetHash.startsWith(parts[1])) {
        return 'reword ' + parts.slice(1).join(' ');
    }
    return line;
});
fs.writeFileSync(file, result.join('\\n'));
`;
            const msgEditorScript = `
const fs = require('fs');
fs.writeFileSync(process.argv[2], ${JSON.stringify(newMessage + '\n')});
`;

            const tmpDir = os.tmpdir();
            const seqEditorPath = path.join(tmpDir, 'git-wiz-seq-editor.js');
            const msgEditorPath = path.join(tmpDir, 'git-wiz-msg-editor.js');
            fs.writeFileSync(seqEditorPath, seqEditorScript);
            fs.writeFileSync(msgEditorPath, msgEditorScript);

            const env = {
                ...process.env,
                GIT_SEQUENCE_EDITOR: `node "${seqEditorPath}"`,
                GIT_EDITOR: `node "${msgEditorPath}"`,
            };

            cp.exec(`git rebase -i ${commitHash}~1`, { cwd, env }, (error, _stdout, stderr) => {
                fs.rmSync(seqEditorPath, { force: true });
                fs.rmSync(msgEditorPath, { force: true });
                if (error) {
                    cp.exec('git rebase --abort', { cwd }, () => {});
                    vscode.window.showErrorMessage(`Failed to edit commit message: ${error.message}\n${stderr}`);
                    return;
                }
                vscode.window.showInformationMessage('Commit message updated successfully');
                this.onRefresh();
            });
        }
    }

    async amendCommit() {
        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            'Amend HEAD commit with staged changes?',
            'Amend',
            'Cancel',
        );
        if (confirm !== 'Amend') {
            return;
        }

        cp.execFile('git', ['commit', '--amend', '--no-edit'], { cwd }, (error, _stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to amend commit: ${stderr || error.message}`);
                return;
            }
            vscode.window.showInformationMessage('Commit amended successfully');
            this.onRefresh();
        });
    }

    async cherryPickCommit(commitHash: string) {
        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        cp.exec(`git cherry-pick ${commitHash}`, { cwd }, (error, _stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to cherry-pick commit: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage('Commit cherry-picked successfully');
            this.onRefresh();
        });
    }

    async copyCommitHash(commitHash: string) {
        await vscode.env.clipboard.writeText(commitHash);
        vscode.window.showInformationMessage('Commit hash copied to clipboard');
    }

    async revertCommit(commitHash: string) {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to revert commit ${commitHash.substring(0, 7)}?`,
            'Yes',
            'No',
        );
        if (confirm !== 'Yes') {
            return;
        }

        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        cp.exec(`git revert ${commitHash} --no-edit`, { cwd }, (error, _stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to revert commit: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage('Commit reverted successfully');
            this.onRefresh();
        });
    }

    async dropCommit(commitHash: string) {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to permanently drop commit ${commitHash.substring(0, 7)}? This cannot be undone.`,
            'Drop',
            'Cancel',
        );
        if (confirm !== 'Drop') {
            return;
        }

        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        cp.exec(`git rebase --onto ${commitHash}^ ${commitHash}`, { cwd }, (error, _stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to drop commit: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage('Commit dropped successfully');
            this.onRefresh();
        });
    }

    async resetToCommit(commitHash: string) {
        if (!commitHash) {
            return;
        }

        const items: (vscode.QuickPickItem & { value: string })[] = [
            { label: 'Soft', description: 'Keep changes staged', value: '--soft' },
            { label: 'Mixed', description: 'Keep changes unstaged', value: '--mixed' },
            { label: 'Hard', description: 'Discard all changes', value: '--hard' },
        ];

        const resetType = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select reset type',
        });

        if (!resetType) {
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to reset to commit ${commitHash.substring(0, 7)} (${resetType.label})?`,
            'Yes',
            'No',
        );
        if (confirm !== 'Yes') {
            return;
        }

        const cwd = this.getCwd();
        if (!cwd) {
            vscode.window.showErrorMessage('No workspace folder found.');
            return;
        }

        cp.exec(`git reset ${resetType.value} "${commitHash}"`, { cwd }, (error, _stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to reset: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage(`Reset to commit ${commitHash.substring(0, 7)} successfully`);
            this.onRefresh();
        });
    }

    async squashCommits(hashes: string[], parentHash: string) {
        if (!parentHash) {
            vscode.window.showErrorMessage('Cannot squash: oldest selected commit has no parent.');
            return;
        }

        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        const newMessage = await vscode.window.showInputBox({
            prompt: `Squash ${hashes.length} commits into one`,
            placeHolder: 'New commit message',
            validateInput: (v) => (!v || !v.trim() ? 'Message cannot be empty' : null),
        });
        if (!newMessage) {
            return;
        }

        const headHash = await new Promise<string>((resolve) => {
            cp.exec('git rev-parse HEAD', { cwd }, (err, stdout) => resolve(err ? '' : stdout.trim()));
        });

        if (hashes[0] === headHash) {
            // Selection ends at HEAD — simple reset + commit
            const escaped = newMessage.replace(/"/g, '\\"');
            cp.exec(`git reset --soft ${parentHash}`, { cwd }, (error) => {
                if (error) {
                    vscode.window.showErrorMessage(`Failed to squash: ${error.message}`);
                    return;
                }
                cp.exec(`git commit -m "${escaped}"`, { cwd }, (err2) => {
                    if (err2) {
                        vscode.window.showErrorMessage(`Failed to commit squash: ${err2.message}`);
                        return;
                    }
                    vscode.window.showInformationMessage(`Squashed ${hashes.length} commits successfully`);
                    this.onRefresh();
                });
            });
        } else {
            // Selection is in the middle — use interactive rebase with scripted editors.
            // hashes[hashes.length-1] is the oldest selected (stays 'pick');
            // all others become 'squash'.
            const squashableHashes = hashes.slice(0, -1);

            const seqEditorScript = `
const fs = require('fs');
const file = process.argv[2];
const squashHashes = ${JSON.stringify(squashableHashes)};
const lines = fs.readFileSync(file, 'utf8').split('\\n');
const result = lines.map(line => {
    const parts = line.trim().split(/\\s+/);
    if ((parts[0] === 'pick' || parts[0] === 'p') && parts[1]) {
        if (squashHashes.some(h => h.startsWith(parts[1]))) {
            return 'squash ' + parts.slice(1).join(' ');
        }
    }
    return line;
});
fs.writeFileSync(file, result.join('\\n'));
`;
            const msgEditorScript = `
const fs = require('fs');
fs.writeFileSync(process.argv[2], ${JSON.stringify(newMessage + '\n')});
`;

            const tmpDir = os.tmpdir();
            const seqEditorPath = path.join(tmpDir, 'git-wiz-seq-editor.js');
            const msgEditorPath = path.join(tmpDir, 'git-wiz-msg-editor.js');
            fs.writeFileSync(seqEditorPath, seqEditorScript);
            fs.writeFileSync(msgEditorPath, msgEditorScript);

            const env = {
                ...process.env,
                GIT_SEQUENCE_EDITOR: `node "${seqEditorPath}"`,
                GIT_EDITOR: `node "${msgEditorPath}"`,
            };

            cp.exec(`git rebase -i ${parentHash}`, { cwd, env }, (error, _stdout, stderr) => {
                fs.rmSync(seqEditorPath, { force: true });
                fs.rmSync(msgEditorPath, { force: true });
                if (error) {
                    cp.exec('git rebase --abort', { cwd }, () => {});
                    vscode.window.showErrorMessage(`Failed to squash: ${error.message}\n${stderr}`);
                    return;
                }
                vscode.window.showInformationMessage(`Squashed ${hashes.length} commits successfully`);
                this.onRefresh();
            });
        }
    }

    async revertCommits(hashes: string[]) {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to revert ${hashes.length} commits? This will create ${hashes.length} new revert commits.`,
            'Yes',
            'No',
        );
        if (confirm !== 'Yes') {
            return;
        }

        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        // hashes are newest-first; revert in that order so each revert applies cleanly
        cp.exec(`git revert ${hashes.join(' ')} --no-edit`, { cwd }, (error, _stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to revert commits: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage(`Reverted ${hashes.length} commits successfully`);
            this.onRefresh();
        });
    }

    async dropCommits(hashes: string[], parentHash: string) {
        if (!parentHash) {
            vscode.window.showErrorMessage('Cannot drop: oldest selected commit has no parent.');
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to permanently drop ${hashes.length} commits? This cannot be undone.`,
            'Drop',
            'Cancel',
        );
        if (confirm !== 'Drop') {
            return;
        }

        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        // hashes[0] is newest; rebase everything after it onto parentHash, dropping the whole range
        cp.exec(`git rebase --onto ${parentHash} ${hashes[0]}`, { cwd }, (error, _stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to drop commits: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage(`Dropped ${hashes.length} commits successfully`);
            this.onRefresh();
        });
    }

    async cherryPickRange(hashes: string[]) {
        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        // hashes are newest-first; cherry-pick oldest to newest
        const ordered = [...hashes].reverse().join(' ');
        cp.exec(`git cherry-pick ${ordered}`, { cwd }, (error, _stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to cherry-pick: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage(`Cherry-picked ${hashes.length} commits successfully`);
            this.onRefresh();
        });
    }

    async mergeBranch(sourceBranch: string) {
        const cwd = this.getCwd();
        if (!cwd) return;

        cp.execFile('git', ['merge', sourceBranch], { cwd }, (error, _stdout, stderr) => {
            if (error) {
                const message = stderr || error.message;
                const isConflict = message.includes('CONFLICT') || message.includes('Conflict');
                if (isConflict) {
                    vscode.window.showErrorMessage(`Merge failed with conflicts: ${message}`, 'Abort Merge', 'Close')
                        .then(choice => {
                            if (choice === 'Abort Merge') {
                                cp.execFile('git', ['merge', '--abort'], { cwd }, () => {
                                    vscode.window.showInformationMessage('Merge aborted');
                                    this.onRefresh();
                                });
                            }
                        });
                } else {
                    vscode.window.showErrorMessage(`Merge failed: ${message}`);
                }
            } else {
                vscode.window.showInformationMessage(`Merged '${sourceBranch}' successfully`);
            }
            this.onRefresh();
        });
    }

    async rebaseBranch(targetBranch: string) {
        const cwd = this.getCwd();
        if (!cwd) return;

        cp.execFile('git', ['rebase', targetBranch], { cwd }, (error, _stdout, stderr) => {
            if (error) {
                cp.execFile('git', ['rebase', '--abort'], { cwd }, () => {
                    vscode.window.showErrorMessage(`Rebase failed: ${stderr || error.message}. Rebase aborted.`);
                    this.onRefresh();
                });
            } else {
                vscode.window.showInformationMessage(`Rebased onto '${targetBranch}' successfully`);
                this.onRefresh();
            }
        });
    }

    async createBranch(branchName: string, startPoint: string) {
        const cwd = this.getCwd();
        if (!cwd) return;

        return new Promise<void>((resolve) => {
            cp.execFile('git', ['branch', branchName, startPoint], { cwd }, (error, _stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Failed to create branch: ${stderr || error.message}`);
                } else {
                    vscode.window.showInformationMessage(`Branch '${branchName}' created successfully`);
                    this.onRefresh();
                }
                resolve();
            });
        });
    }

    async createTag(tagName: string, commitHash: string) {
        const cwd = this.getCwd();
        if (!cwd) return;

        return new Promise<void>((resolve) => {
            cp.execFile('git', ['tag', tagName, commitHash], { cwd }, async (error, _stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Failed to create tag: ${stderr || error.message}`);
                } else {
                    const action = await vscode.window.showInformationMessage(`Tag '${tagName}' created successfully`, 'Push Tag');
                    this.onRefresh();
                    if (action === 'Push Tag') {
                        this.pushTag(tagName);
                    }
                }
                resolve();
            });
        });
    }

    async pushTag(tagName: string) {
        const cwd = this.getCwd();
        if (!cwd) return;

        return new Promise<void>((resolve) => {
            cp.execFile('git', ['remote'], { cwd }, async (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Failed to get remotes: ${stderr || error.message}`);
                    resolve();
                    return;
                }

                const remotes = stdout.trim().split('\n').filter(Boolean);
                if (remotes.length === 0) {
                    vscode.window.showErrorMessage('No remotes found. Cannot push tag.');
                    resolve();
                    return;
                }

                let targetRemote = remotes.includes('origin') ? 'origin' : remotes[0];
                if (remotes.length > 1) {
                    const picked = await vscode.window.showQuickPick(remotes, {
                        placeHolder: 'Select a remote to push the tag to',
                    });
                    if (!picked) {
                        resolve();
                        return;
                    }
                    targetRemote = picked;
                }

                cp.execFile('git', ['push', targetRemote, tagName], { cwd }, (pushError, _pushStdout, pushStderr) => {
                    if (pushError) {
                        vscode.window.showErrorMessage(`Failed to push tag: ${pushStderr || pushError.message}`);
                    } else {
                        vscode.window.showInformationMessage(`Tag '${tagName}' pushed to '${targetRemote}' successfully`);
                    }
                    resolve();
                });
            });
        });
    }

    async getFileContentAtRev(hash: string, filePath: string): Promise<string> {
        return new Promise((resolve) => {
            const cwd = this.getCwd();
            if (!cwd) {
                resolve('');
                return;
            }
            cp.execFile('git', ['show', `${hash}:${filePath}`], { cwd }, (error, stdout) => {
                if (error) {
                    resolve('');
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    async getCommitFiles(hash: string): Promise<{ status: string; path: string; insertions?: number; deletions?: number }[]> {
        return new Promise((resolve, reject) => {
            const cwd = this.getCwd();
            if (!cwd) {
                reject(new Error('No workspace folder found'));
                return;
            }
            // First get name-status
            cp.execFile('git', ['diff-tree', '--no-commit-id', '--name-status', '-r', hash, '--root'], { cwd }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Failed to load commit files: ${stderr || error.message}`));
                    return;
                }
                
                const output = stdout.trim();
                const statusMap = new Map<string, string>();
                
                if (output) {
                    output.split('\n').filter(Boolean).forEach(line => {
                        const [status, ...paths] = line.split('\t');
                        statusMap.set(paths[paths.length - 1], status.charAt(0));
                    });
                }

                // If no output from diff-tree, it might be the initial commit or something else.
                // But with --root it should show initial commit.
                // If still empty, we can try numstat.
                cp.execFile('git', ['diff-tree', '--no-commit-id', '--numstat', '-r', hash, '--root'], { cwd }, (err, numOut) => {
                    if (err) {
                        resolve(Array.from(statusMap.entries()).map(([path, status]) => ({ status, path })));
                        return;
                    }
                    
                    const numMap = new Map<string, { insertions: number, deletions: number }>();
                    const numLines = numOut.trim().split('\n').filter(Boolean);
                    
                    numLines.forEach(line => {
                        const parts = line.split('\t');
                        if (parts.length >= 3) {
                            const ins = parseInt(parts[0], 10) || 0;
                            const del = parseInt(parts[1], 10) || 0;
                            numMap.set(parts[parts.length - 1], { insertions: ins, deletions: del });
                        }
                    });

                    // If statusMap is empty but numMap isn't, use numMap to populate paths (status will be 'A' for root commit)
                    if (statusMap.size === 0 && numMap.size > 0) {
                        numMap.forEach((_, path) => statusMap.set(path, 'A'));
                    }

                    const files = Array.from(statusMap.entries()).map(([path, status]) => {
                        const stats = numMap.get(path);
                        return {
                            status,
                            path,
                            insertions: stats?.insertions,
                            deletions: stats?.deletions
                        };
                    });
                    resolve(files);
                });
            });
        });
    }
}
