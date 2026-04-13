// Must match the GitCommit interface in gitOperations.ts
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
