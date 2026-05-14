import type { GitService } from "../gitOperations";

export class AsyncHighlightVerifier {
    private _queue: { hash: string; targets: string[] }[] = [];
    private _inProgress = 0;
    private readonly MAX_CONCURRENCY = 3;
    private _patchIdCache = new Map<string, string>();

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
        let pid = this._patchIdCache.get(hash);
        if (pid === undefined) {
            pid = await this._gitService.getPatchId(hash);
            this._patchIdCache.set(hash, pid);
        }
        return pid;
    }

    private async verify(hash: string, targets: string[]): Promise<"verified" | "failed"> {
        const sourcePid = await this.getPatchId(hash);
        for (const target of targets) {
            const targetPid = await this.getPatchId(target);
            if (sourcePid === targetPid && sourcePid !== "") {
                return "verified";
            }
        }

        return "failed";
    }
}
