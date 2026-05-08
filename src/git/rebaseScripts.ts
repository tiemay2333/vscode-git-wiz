/**
 * Pure functions that generate inline Node.js scripts for git interactive rebase.
 *
 * Git's GIT_SEQUENCE_EDITOR receives the rebase todo file path as argv[2] and
 * must edit it in place. GIT_EDITOR receives the commit message file as argv[2].
 *
 * These scripts are intentionally self-contained (no project imports) because
 * they run as standalone node processes via the GIT_SEQUENCE_EDITOR / GIT_EDITOR
 * environment variables.
 */

export interface RebaseOverride {
    hash: string;
    action: string;
}

/**
 * Generates a GIT_SEQUENCE_EDITOR script that rewrites specified commits' actions.
 *
 * @param overrides — list of { hash, action } pairs. If the todo file contains a
 *   pick/p line whose hash prefix matches, its action is replaced.
 */
export function makeSeqEditorScript(overrides: RebaseOverride[]): string {
    const overridesJson = JSON.stringify(overrides);
    return `
const fs = require('fs');
const file = process.argv[2];
const overrides = ${overridesJson};
const lines = fs.readFileSync(file, 'utf8').split('\\n');
const result = lines.map(line => {
    const parts = line.trim().split(/\\s+/);
    if ((parts[0] === 'pick' || parts[0] === 'p') && parts[1]) {
        for (const o of overrides) {
            if (o.hash.startsWith(parts[1]) || parts[1].startsWith(o.hash)) {
                return o.action + ' ' + parts.slice(1).join(' ');
            }
        }
    }
    return line;
});
fs.writeFileSync(file, result.join('\\n'));
`;
}

/**
 * Generates a GIT_EDITOR script that writes a fixed message to the commit message file.
 */
export function makeMsgEditorScript(message: string): string {
    const msg = JSON.stringify(`${message}\n`);
    return `
const fs = require('fs');
fs.writeFileSync(process.argv[2], ${msg});
`;
}
