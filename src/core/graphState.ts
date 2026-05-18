export interface SearchFilters {
    query?: string;
    author?: string;
    from?: string;
    to?: string;
}

export class GraphState {
    private _filterBranch: string | null = null;
    private _filterFile: string | null = null;
    private _loadedCount = 0;
    private _searchFilters?: SearchFilters;

    public get filterBranch(): string | null {
        return this._filterBranch;
    }

    public set filterBranch(value: string | null) {
        this._filterBranch = value;
    }

    public get filterFile(): string | null {
        return this._filterFile;
    }

    public set filterFile(value: string | null) {
        this._filterFile = value;
    }

    public get loadedCount(): number {
        return this._loadedCount;
    }

    public set loadedCount(value: number) {
        this._loadedCount = value;
    }

    public get searchFilters(): SearchFilters | undefined {
        return this._searchFilters;
    }

    public set searchFilters(value: SearchFilters | undefined) {
        this._searchFilters = value;
    }

    public resetPagination(): void {
        this._loadedCount = 0;
    }

    public resetFilters(): void {
        this._filterBranch = null;
        this._filterFile = null;
        this._searchFilters = undefined;
        this.resetPagination();
    }
}
