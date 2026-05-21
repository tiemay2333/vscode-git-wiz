/**
 * RefreshManager 采用状态机 + 请求合并方案管理刷新逻辑。
 * 当刷新正在进行时，新的请求将被合并，仅在当前刷新结束后执行最后一次最新请求。
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
            this.refresh();
        }
    }

    public get isInitialized(): boolean {
        return this._initialized;
    }

    public get isRefreshing(): boolean {
        return this._refreshing;
    }

    /**
     * 请求刷新。如果正在刷新，则将请求标记为待处理。
     */
    public async refresh(resetScroll: boolean = false) {
        if (!this._initialized) {
            this._pendingRefresh = true;
            this._pendingResetScroll = this._pendingResetScroll || resetScroll;
            return;
        }

        if (this._refreshing) {
            this._pendingRefresh = true;
            this._pendingResetScroll = this._pendingResetScroll || resetScroll;
            return;
        }

        await this.triggerRefresh(resetScroll);
    }

    private async triggerRefresh(resetScroll: boolean = false) {
        const actualResetScroll = resetScroll || this._pendingResetScroll;
        this._pendingResetScroll = false;
        this._pendingRefresh = false;

        this._refreshing = true;
        try {
            await this._refreshCallback(actualResetScroll);
        }
        finally {
            this._refreshing = false;
            if (this._pendingRefresh) {
                const nextReset = this._pendingResetScroll;
                this._pendingRefresh = false;
                this._pendingResetScroll = false;
                // 使用 Promise.resolve() 确保在微任务队列中执行，避免递归深度过大
                Promise.resolve().then(() => this.refresh(nextReset));
            }
        }
    }
}
