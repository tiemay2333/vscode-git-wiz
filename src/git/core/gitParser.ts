export interface GitCommit {
    hash: string;
    shortHash: string;
    message: string;
    date: string;
    timestamp: number;
    authorTimestamp: number;
    author: string;
    email: string;
    parents: string[];
    refs: string[];
}

export function parseGitLogOutput(stdout: string): GitCommit[] {
    return stdout
        .split("\n")
        .filter(line => line.trim())
        .map((line) => {
            const [fullHash, shortHash, parents, author, email, date, refs, ct, at, ...messageParts] = line.split("\x1F");
            const refList = refs
                ? refs
                        .trim()
                        .split(",")
                        .map(r => r.trim())
                        .filter(r => r)
                : [];
            return {
                hash: fullHash.trim(),
                shortHash: shortHash.trim(),
                message: messageParts.join("\x1F").trim(),
                date: new Date(date.trim()).toLocaleString(),
                timestamp: Number.parseInt(ct.trim(), 10),
                authorTimestamp: Number.parseInt(at.trim(), 10),
                author: author.trim(),
                email: email.trim(),
                parents: parents
                    .trim()
                    .split(" ")
                    .map(p => p.trim())
                    .filter(p => p),
                refs: refList,
            };
        });
}
