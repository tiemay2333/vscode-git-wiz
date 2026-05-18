import type { GitService } from "@/git/core/gitOperations";

export class AsyncHighlightVerifier {
    private _queue: { hash: string; targets: string[] }[] = [];
    private _inProgress = 0;
    private readonly MAX_CONCURRENCY = 3;
    private _patchIdCache = new Map<string, string>();
    private _filePatchIdCache = new Map<string, Map<string, string>>();

    constructor(
        private readonly _gitService: GitService,
        private readonly _onUpdate: (hash: string, status: "verified" | "failed") => void,
    ) { }

    public queueVerification(hash: string, targets: string[]) {
        if (this._queue.some(q => q.hash === hash))
            return;
        this._queue.push({ hash, targets });
        this.processQueue();
    }

    public reset() {
        this._queue = [];
        this._patchIdCache.clear();
        this._filePatchIdCache.clear();
    }

    public dispose() {
        this.reset();
    }

    private async processQueue() {
        if (this._inProgress >= this.MAX_CONCURRENCY || this._queue.length === 0)
            return;

        const item = this._queue.shift()!;
        this._inProgress++;

        try {
            const status = await this.verify(item.hash, item.targets);
            this._onUpdate(item.hash, status);
        }
        catch {
            this._onUpdate(item.hash, "failed");
        }
        finally {
            this._inProgress--;
            this.processQueue();
        }
    }

    private async getPatchId(hash: string): Promise<string> {
        const cached = this._patchIdCache.get(hash);
        if (cached !== undefined) {
            return cached;
        }
        const pid = await this._gitService.getPatchId(hash);
        this._patchIdCache.set(hash, pid);
        return pid;
    }

    private async getFilePatchIds(hash: string): Promise<Map<string, string>> {
        const cached = this._filePatchIdCache.get(hash);
        if (cached !== undefined) {
            return cached;
        }
        const pids = await this._gitService.getCommitFilePatchIds(hash);
        this._filePatchIdCache.set(hash, pids);
        return pids;
    }

    private async verify(hash: string, targets: string[]): Promise<"verified" | "failed"> {
        const sourcePid = await this.getPatchId(hash);
        for (const target of targets) {
            const targetPid = await this.getPatchId(target);
            if (sourcePid === targetPid && sourcePid !== "") {
                return "verified";
            }
        }

        // Tier 4: Partial File Matching (PFM) - Target ⊆ Source
        // (Highlight Source if every file in Target exists in Source with matching content)
        const sourceFilePids = await this.getFilePatchIds(hash);
        if (sourceFilePids.size === 0)
            return "failed";

        for (const target of targets) {
            const targetFilePids = await this.getFilePatchIds(target);

            if (targetFilePids.size === 0 || targetFilePids.size > sourceFilePids.size)
                continue;

            let matches = true;
            for (const [path, targetPid] of targetFilePids.entries()) {
                const sourcePid = sourceFilePids.get(path);
                if (sourcePid === undefined || sourcePid !== targetPid) {
                    matches = false;
                    break;
                }
            }

            if (matches) {
                return "verified";
            }
        }

        return "failed";
    }
}
