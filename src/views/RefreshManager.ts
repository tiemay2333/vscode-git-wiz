import type { RefreshOptions } from "./dataManager/IViewDataManager";

/**
 * RefreshManager 负责视图层的刷新流控。
 * 1. 确保在 Webview 未就绪（ready）时不执行刷新，而是将请求挂起。
 * 2. 确保在刷新正在进行时，不会发起并发刷新，而是合并后续请求。
 */
export class RefreshManager {
    private _refreshing = false;
    private _pendingRefresh = false;
    private _pendingResetScroll = false;
    private _initialized = false;

    constructor(private readonly _refreshCallback: (resetScroll: boolean) => Promise<void>) {}

    public setInitialized(initialized: boolean) {
        this._initialized = initialized;
        if (this._initialized && this._pendingRefresh) {
            this.refresh({ resetScroll: this._pendingResetScroll });
        }
    }

    public get isInitialized(): boolean {
        return this._initialized;
    }

    public get isRefreshing(): boolean {
        return this._refreshing;
    }

    /**
     * 请求刷新。如果正在刷新或未初始化，则将请求标记为待处理。
     */
    public async refresh(options: RefreshOptions = {}) {
        const resetScroll = !!options.resetScroll;

        if (!this._initialized || this._refreshing) {
            this._pendingRefresh = true;
            this._pendingResetScroll = this._pendingResetScroll || resetScroll;
            return;
        }

        await this.triggerRefresh(resetScroll);
    }

    private async triggerRefresh(resetScroll: boolean) {
        this._pendingResetScroll = false;
        this._pendingRefresh = false;

        this._refreshing = true;
        try {
            await this._refreshCallback(resetScroll);
        }
        finally {
            this._refreshing = false;
            if (this._pendingRefresh) {
                const nextReset = this._pendingResetScroll;
                // 使用 Promise.resolve() 确保在微任务队列中执行，避免递归深度过大
                Promise.resolve().then(() => this.refresh({ resetScroll: nextReset }));
            }
        }
    }
}
