# Research: Git Commit Fingerprint and Patch ID

- **Query**: Research how to get a "fingerprint" of a commit (modified files, lines added/deleted) and how to compute `patch-id`. Provide Node.js/TypeScript examples.
- **Scope**: Internal / External
- **Date**: 2025-05-13

## Findings

### 1. Commit Fingerprint (Numstat)

To efficiently get a list of modified files and the number of lines added/deleted for each, use `git show` with the `--numstat` flag.

#### Command
```bash
git show --numstat --format="" <commit-hash>
```

- `--numstat`: Generates a machine-readable summary of changes.
- `--format=""`: Suppresses the commit message and metadata, leaving only the file stats.

#### Output Format
Each line follows the pattern:
`<added> <deleted> <file_path>`

Example:
```
12      4       src/main.ts
0       1       README.md
```
*Note: For binary files, it shows `- -` instead of numbers.*

### 2. Git Patch ID

A `patch-id` is a hash of the changes in a commit, ignoring metadata like author, date, and commit message. It is useful for identifying "same" changes across different branches (e.g., after cherry-picking).

#### Command
```bash
git show <commit-hash> | git patch-id
```

#### Behavior
- It ignores line numbers and whitespace (by default).
- It generates a stable ID even if the diff is applied at different offsets.

### 3. Node.js / TypeScript Implementation

Using the `GitRunner` pattern (common in VS Code extensions), we can execute these commands and parse the results.

#### Execution Helper (using `execFile`)
```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/**
 * Gets the fingerprint (numstat) of a commit.
 */
async function getCommitFingerprint(hash: string) {
    const { stdout } = await exec('git', ['show', '--numstat', '--format=', hash]);
    return stdout.trim().split('\n').map(line => {
        const [added, deleted, path] = line.split(/\s+/);
        return {
            added: added === '-' ? null : parseInt(added, 10),
            deleted: deleted === '-' ? null : parseInt(deleted, 10),
            path
        };
    });
}

/**
 * Computes the patch-id of a commit.
 * Uses piping for efficiency and compatibility with git patch-id stdin.
 */
async function getPatchId(hash: string): Promise<string> {
    const { spawn } = await import('node:child_process');
    
    return new Promise((resolve, reject) => {
        const show = spawn('git', ['show', hash]);
        const patchId = spawn('git', ['patch-id']);

        show.stdout.pipe(patchId.stdin);

        let output = '';
        patchId.stdout.on('data', (data) => {
            output += data.toString();
        });

        patchId.on('close', (code) => {
            if (code === 0) {
                // Output format: <patch-id> <commit-hash>
                resolve(output.trim().split(' ')[0]);
            } else {
                reject(new Error(`git patch-id failed with code ${code}`));
            }
        });

        show.on('error', reject);
        patchId.on('error', reject);
    });
}
```

## Caveats / Not Found

- **Binary Files**: `--numstat` returns `-` for added/deleted counts on binary files.
- **Piping in Node.js**: While `exec` is simpler, `spawn` is preferred for `patch-id` to avoid loading large patches entirely into memory before piping to the next process.
- **Large Commits**: For extremely large commits, the `maxBuffer` in `execFile` might need to be increased if not using streams.
