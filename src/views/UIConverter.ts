import type { GitCommit, GitService } from "@/git/core/GitService";
import { getCurrentBranchHashes } from "@/git/highlight/commitHighlight";

export interface CommitUIStatus {
    isCurrentBranch?: boolean;
    verificationStatus?: "pending" | "verified" | "failed";
}

/**
 * UIConverter 负责将 Git 领域对象转换为 Webview 所需的 UI 状态。
 * 同时管理相关的签名缓存。
 */
export class UIConverter {
    private _signaturesLoadingPromise: Promise<void> | null = null;
    private _branchSignaturesCache: { branch: string; headHash: string; signatures: Map<string, string[]> } | null = null;

    constructor(private readonly _gitService: GitService) {}

    /**
     * 计算提交的 UI 状态（是否在当前分支，签名验证状态等）
     */
    public async calculateUIStatus(commits: GitCommit[], currentBranch: string): Promise<Record<string, CommitUIStatus>> {
        const branchHashes = await this._gitService.history.getBranchCommits(currentBranch);

        await this.ensureSignaturesLoaded(currentBranch);

        if (!this._branchSignaturesCache) {
            return {};
        }

        const result = getCurrentBranchHashes(commits, branchHashes, this._branchSignaturesCache.signatures);
        const uiStatus: Record<string, CommitUIStatus> = {};

        for (const c of commits) {
            if (result.verified.has(c.hash)) {
                uiStatus[c.hash] = { isCurrentBranch: true, verificationStatus: "verified" };
            }
            else if (result.pending.has(c.hash)) {
                uiStatus[c.hash] = { isCurrentBranch: true, verificationStatus: "pending" };
            }
            else {
                uiStatus[c.hash] = { isCurrentBranch: false };
            }
        }

        return uiStatus;
    }

    public resetCache() {
        this._branchSignaturesCache = null;
        this._signaturesLoadingPromise = null;
    }

    public async ensureSignaturesLoaded(currentBranch: string): Promise<void> {
        while (true) {
            const headHash = await this._gitService.refs.getHeadHash(currentBranch);
            if (this._branchSignaturesCache
                && this._branchSignaturesCache.branch === currentBranch
                && (!headHash || this._branchSignaturesCache.headHash === headHash)) {
                break;
            }

            if (!this._signaturesLoadingPromise) {
                this._signaturesLoadingPromise = (async () => {
                    try {
                        const signatures = await this._gitService.history.getBranchCommitSignatures(currentBranch);
                        this._branchSignaturesCache = {
                            branch: currentBranch,
                            headHash: headHash || "",
                            signatures,
                        };
                    }
                    finally {
                        this._signaturesLoadingPromise = null;
                    }
                })();
            }
            await this._signaturesLoadingPromise;
        }
    }

    public get signaturesCache() {
        return this._branchSignaturesCache;
    }
}
