export interface GitCommit {
    hash: string;
    shortHash: string;
    message: string;
    date: string;
    timestamp: number;
    author: string;
    email: string;
    parents: string[];
    refs: string[];
}

export function parseGitLogOutput(stdout: string): GitCommit[] {
    return stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
            const [fullHash, shortHash, parents, author, email, date, refs, ct, ...messageParts] = line.split('|');
            const refList = refs
                .trim()
                .split(',')
                .map((r) => r.trim())
                .filter((r) => r);
            return {
                hash: fullHash.trim(),
                shortHash: shortHash.trim(),
                message: messageParts.join('|').trim(),
                date: new Date(date).toLocaleString(),
                timestamp: parseInt(ct, 10),
                author: author.trim(),
                email: email.trim(),
                parents: parents
                    .trim()
                    .split(' ')
                    .map((p) => p.trim())
                    .filter((p) => p),
                refs: refList,
            };
        });
}
