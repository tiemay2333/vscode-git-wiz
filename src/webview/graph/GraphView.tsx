import type { GitCommit } from "../../gitParser";
import type { SettingsData } from "../settings/SettingsForm";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SettingsForm } from "../settings/SettingsForm";
import { FileTree } from "../shared/FileTree";
import { vscode } from "../vscodeApi";
import { CommitRow } from "./CommitRow";
import { computeGraphLayout } from "./graphLayout";

function areCommitsConsecutive(commits: GitCommit[], sortedIndices: number[]): boolean {
    for (let i = 0; i < sortedIndices.length - 1; i++) {
        const newer = commits[sortedIndices[i]];
        const older = commits[sortedIndices[i + 1]];
        if (newer.parents.length !== 1 || !newer.parents.includes(older.hash)) {
            return false;
        }
    }
    return true;
}

function FileList({
    files,
    onOpenDiff,
    onOpenFile,
}: {
    files: { status: string; path: string; insertions?: number; deletions?: number }[];
    onOpenDiff: (path: string) => void;
    onOpenFile: (path: string) => void;
}) {
    return (
        <div className="file-list">
            {files
                .sort((a, b) => a.path.localeCompare(b.path))
                .map(file => (
                    <div key={file.path} className="file-list-item" onClick={() => onOpenDiff(file.path)}>
                        <div className="file-list-file">
                            <span className={`file-status file-status-${file.status?.toLowerCase()}`}>
                                {file.status}
                            </span>
                            <span className={`file-name file-name-${file.status?.toLowerCase()}`}>{file.path}</span>
                            {(file.insertions! > 0 || file.deletions! > 0) && (
                                <span className="file-stats">
                                    {file.insertions! > 0 && (
                                        <span className="stat-added">
                                            +
                                            {file.insertions}
                                        </span>
                                    )}
                                    {file.deletions! > 0 && (
                                        <span className="stat-removed">
                                            -
                                            {file.deletions}
                                        </span>
                                    )}
                                </span>
                            )}
                            <span
                                className="open-file-btn"
                                title="Open locally"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenFile(file.path);
                                }}
                            >
                                ↗
                            </span>
                        </div>
                    </div>
                ))}
        </div>
    );
}

interface SingleMenu {
    x: number;
    y: number;
    hash: string;
    index: number;
}
interface RangeMenu {
    x: number;
    y: number;
    sortedIndices: number[];
    hashes: string[];
    consecutive: boolean;
}

interface Props {
    commits: GitCommit[];
    hasMore: boolean;
    filterBranch?: string | null;
    filterFile?: string | null;
    currentBranch?: string | null;
    showGraph?: boolean;
}

export function GraphView({
    commits: initialCommits,
    hasMore: initialHasMore,
    currentBranch: initialCurrentBranch,
    filterBranch: initialFilterBranch,
    filterFile: initialFilterFile,
    showGraph: initialShowGraph,
}: Props) {
    const [commitFiles, setCommitFiles] = useState<
        Record<string, { status: string; path: string; insertions?: number; deletions?: number }[]>
    >({});
    const [commits, setCommits] = useState(initialCommits);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [currentBranch, setCurrentBranch] = useState(initialCurrentBranch);
    const [filterBranch, setFilterBranch] = useState<string | null | undefined>(initialFilterBranch);
    const [filterFile, setFilterFile] = useState<string | null | undefined>(initialFilterFile);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [filesViewMode, setFilesViewMode] = useState<"tree" | "list">(
        (window as unknown as { __FILES_VIEW_MODE__?: "tree" | "list" }).__FILES_VIEW_MODE__ || "list",
    );

    const [searchQuery, setSearchQuery] = useState("");
    const [searchAuthor, setSearchAuthor] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [activeSearch, setActiveSearch] = useState({ query: "", author: "", from: "", to: "" });

    const [highlightCurrent, setHighlightCurrent] = useState<boolean>(
        (window as unknown as { __HIGHLIGHT_CURRENT_BRANCH__?: boolean }).__HIGHLIGHT_CURRENT_BRANCH__ || false,
    );
    const [showTags, setShowTags] = useState<boolean>(
        (window as unknown as { __SHOW_TAGS__?: boolean }).__SHOW_TAGS__ ?? true,
    );
    const [showRemoteBranches, setShowRemoteBranches] = useState<boolean>(
        (window as unknown as { __SHOW_REMOTE_BRANCHES__?: boolean }).__SHOW_REMOTE_BRANCHES__ ?? true,
    );
    const [showGraph, setShowGraph] = useState<boolean>(initialShowGraph ?? true);

    const [selectedIndices, setSelectedIndices] = useState(new Set<number>());
    const [rangeStartIndex, setRangeStartIndex] = useState<number | null>(null);
    const [loadingHash, setLoadingHash] = useState<string | null>(null);
    const [singleMenu, setSingleMenu] = useState<SingleMenu | null>(null);
    const [rangeMenu, setRangeMenu] = useState<RangeMenu | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsData, setSettingsData] = useState<SettingsData | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const ctxMenuRef = useRef<HTMLDivElement>(null);
    const commitsRef = useRef(commits);
    const selectedIndicesRef = useRef(selectedIndices);
    const shouldScrollToTopRef = useRef(false);

    useLayoutEffect(() => {
        if (shouldScrollToTopRef.current && containerRef.current) {
            containerRef.current.scrollTop = 0;
            shouldScrollToTopRef.current = false;
        }
    }, [commits]);

    const filteredCommits = commits;

    useEffect(() => {
        if (loadingHash && commitFiles[loadingHash]) {
            const index = filteredCommits.findIndex(c => c.hash === loadingHash);
            if (index !== -1) {
                setSelectedIndices(new Set([index]));
            }
            setLoadingHash(null);
        }
    }, [loadingHash, commitFiles, filteredCommits]);
    const isSearching = !!(activeSearch.query || activeSearch.author || activeSearch.from || activeSearch.to);
    const isFiltering = isSearching || !!filterFile;
    const graphNodes = useMemo(() => {
        if (isFiltering) {
            return filteredCommits.map(commit => ({ commit, x: 0, color: 0, lines: [], maxTrack: 0 }));
        }
        return computeGraphLayout(filteredCommits);
    }, [filteredCommits, isFiltering]);
    const globalMaxTrack = useMemo(
        () => graphNodes.reduce((max, node) => Math.max(max, node.maxTrack), 0),
        [graphNodes],
    );
    const graphWidth = !showGraph ? 0 : isFiltering ? 24 : Math.max(60, globalMaxTrack * 12 + 24);

    const closeMenus = useCallback(() => {
        setSingleMenu(null);
        setRangeMenu(null);
    }, []);

    useEffect(() => {
        commitsRef.current = commits;
        selectedIndicesRef.current = selectedIndices;
    });

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const msg = event.data;
            if (msg.command === "appendCommits") {
                setCommits(prev => [...prev, ...msg.commits]);
                setHasMore(msg.hasMore);
                setIsLoadingMore(false);
            }
            else if (msg.command === "replaceCommits") {
                if (msg.resetScroll) {
                    shouldScrollToTopRef.current = true;
                }

                const oldCommits = commitsRef.current;
                const oldIndices = selectedIndicesRef.current;
                const oldHashes = new Set(
                    Array.from(oldIndices)
                        .map(i => oldCommits[i]?.hash)
                        .filter(Boolean),
                );
                const newIndices = new Set<number>();
                msg.commits.forEach((c: GitCommit, i: number) => {
                    if (oldHashes.has(c.hash))
                        newIndices.add(i);
                });

                setCommits(msg.commits);
                setHasMore(msg.hasMore);
                if (msg.currentBranch !== undefined) {
                    setCurrentBranch(msg.currentBranch);
                }
                setFilterBranch(msg.filterBranch);
                if (msg.filterFile !== undefined) {
                    setFilterFile(msg.filterFile);
                }
                if (msg.highlightCurrentBranch !== undefined) {
                    setHighlightCurrent(msg.highlightCurrentBranch);
                }
                if (msg.showTags !== undefined) {
                    setShowTags(msg.showTags);
                }
                if (msg.showRemoteBranches !== undefined) {
                    setShowRemoteBranches(msg.showRemoteBranches);
                }
                if (msg.showGraph !== undefined) {
                    setShowGraph(msg.showGraph);
                }
                setIsLoadingMore(false);
                setSelectedIndices(newIndices);
                setRangeStartIndex(null);
                setSingleMenu(null);
                setRangeMenu(null);
            }
            else if (msg.command === "commitFilesData") {
                if (msg.error) {
                    vscode.postMessage({ command: "showErrorMessage", error: msg.error });
                    setLoadingHash(null);
                }
                else {
                    setCommitFiles(prev => ({ ...prev, [msg.commitHash]: msg.files }));
                    setLoadingHash(prev => (prev === msg.commitHash ? msg.commitHash : prev));
                }
            }
            else if (msg.command === "showSettingsModal") {
                setSettingsData(msg.data);
                setShowSettings(true);
            }
            else if (msg.command === "updateShowTags") {
                setShowTags(msg.value as boolean);
            }
            else if (msg.command === "updateShowRemoteBranches") {
                setShowRemoteBranches(msg.value as boolean);
            }
            else if (msg.command === "updateShowGraph") {
                setShowGraph(msg.value as boolean);
            }
        };
        window.addEventListener("message", handler);

        const clickOutside = (e: MouseEvent) => {
            if (ctxMenuRef.current?.contains(e.target as Node) || (e.target as Element).closest(".settings-modal-content")) {
                return;
            }
            closeMenus();
        };
        window.addEventListener("click", clickOutside);

        const escHandler = (e: KeyboardEvent) => {
            if (e.key === "Escape")
                setShowSettings(false);
        };
        window.addEventListener("keydown", escHandler);

        return () => {
            window.removeEventListener("message", handler);
            window.removeEventListener("click", clickOutside);
            window.removeEventListener("keydown", escHandler);
        };
    }, [closeMenus]);

    const handleSearch = useCallback(() => {
        shouldScrollToTopRef.current = true;
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
        setActiveSearch({ query: searchQuery, author: searchAuthor, from: dateFrom, to: dateTo });
        vscode.postMessage({
            command: "search",
            filters: { query: searchQuery, author: searchAuthor, from: dateFrom, to: dateTo },
        });
    }, [searchQuery, searchAuthor, dateFrom, dateTo]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                handleSearch();
            }
        },
        [handleSearch],
    );

    const headCommitHash = useMemo(() => {
        if (!commits.length)
            return undefined;

        // 1. Prioritize commit with HEAD pointing to current branch
        if (currentBranch) {
            const headOnBranch = commits.find(c =>
                c.refs.some(r => r === `HEAD -> ${currentBranch}` || r === `refs/heads/${currentBranch}`),
            );
            if (headOnBranch)
                return headOnBranch.hash;
        }

        // 2. Look for any HEAD (detached or otherwise)
        const anyHead = commits.find(c => c.refs.some(r => r.startsWith("HEAD -> ") || r === "HEAD"));
        if (anyHead)
            return anyHead.hash;

        // 3. Look for current branch ref name
        if (currentBranch) {
            const branchRef = commits.find(c =>
                c.refs.some(r => r === currentBranch || r.endsWith(`/${currentBranch}`)),
            );
            if (branchRef)
                return branchRef.hash;
        }

        // 4. Fallback if strictly filtering by current branch
        if (filterBranch && filterBranch === currentBranch) {
            return commits[0]?.hash;
        }

        return undefined;
    }, [commits, currentBranch, filterBranch]);

    const branchLabel = useMemo(() => {
        const headPart
            = currentBranch && filterBranch !== currentBranch
                ? ` (HEAD on ${currentBranch})`
                : "";
        const branchPart = (filterBranch || "All Branches") + headPart;
        if (filterFile) {
            return `File: ${filterFile} — ${branchPart}`;
        }
        return branchPart;
    }, [currentBranch, filterBranch, filterFile]);

    const headCommitAncestors = useMemo(() => {
        const result = new Set<string>();
        if (!headCommitHash || !commits.length)
            return result;

        const queue = [headCommitHash];
        const parentMap = new Map<string, string[]>();
        for (const c of commits) {
            parentMap.set(c.hash, c.parents);
        }

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (result.has(current))
                continue;
            result.add(current);

            const parents = parentMap.get(current);
            if (parents) {
                for (const p of parents) {
                    if (!result.has(p))
                        queue.push(p);
                }
            }
        }
        return result;
    }, [commits, headCommitHash]);

    const handleLoadMore = () => {
        if (!hasMore || isLoadingMore)
            return;
        setIsLoadingMore(true);
        vscode.postMessage({ command: "loadMoreCommits" });
    };

    useLayoutEffect(() => {
        const el = ctxMenuRef.current;
        if (!el)
            return;
        const rect = el.getBoundingClientRect();
        let { x, y } = singleMenu || rangeMenu || { x: 0, y: 0 };
        const winH = window.innerHeight;
        const winW = window.innerWidth;

        if (x + rect.width > winW) {
            x = Math.max(8, winW - rect.width - 8);
        }
        if (y + rect.height > winH) {
            y = Math.max(8, winH - rect.height - 8);
        }

        el.style.left = `${Math.max(8, x)}px`;
        el.style.top = `${Math.max(8, y)}px`;
        el.style.maxHeight = `${winH - 16}px`;
    }, [singleMenu, rangeMenu]);

    const handleRowClick = useCallback(
        (index: number, shiftKey: boolean) => {
            if (shiftKey && rangeStartIndex !== null) {
                const min = Math.min(rangeStartIndex, index);
                const max = Math.max(rangeStartIndex, index);
                const next = new Set<number>();
                for (let i = min; i <= max; i++) {
                    next.add(i);
                }
                setSelectedIndices(next);
            }
            else {
                setRangeStartIndex(index);
                const hash = filteredCommits[index].hash;

                if (selectedIndices.size === 1 && selectedIndices.has(index)) {
                    setSelectedIndices(new Set());
                }
                else {
                    if (commitFiles[hash]) {
                        setSelectedIndices(new Set([index]));
                    }
                    else {
                        setLoadingHash(hash);
                        vscode.postMessage({ command: "getCommitFiles", commitHash: hash });
                    }
                }
            }
            closeMenus();
        },
        [rangeStartIndex, closeMenus, filteredCommits, commitFiles, selectedIndices],
    );

    const handleContextMenu = useCallback(
        (e: React.MouseEvent, index: number) => {
            e.preventDefault();
            e.stopPropagation();

            if (selectedIndices.size > 1 && selectedIndices.has(index)) {
                const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
                const hashes = sortedIndices.map(i => filteredCommits[i].hash);
                setRangeMenu({
                    x: e.clientX,
                    y: e.clientY,
                    sortedIndices,
                    hashes,
                    consecutive: areCommitsConsecutive(filteredCommits, sortedIndices),
                });
                setSingleMenu(null);
            }
            else {
                const hash = filteredCommits[index].hash;
                setSingleMenu({ x: e.clientX, y: e.clientY, hash, index });
                setRangeMenu(null);
            }
        },
        [selectedIndices, filteredCommits],
    );

    const handleSingleAction = useCallback(
        (action: string, extraArgs: Record<string, unknown> = {}) => {
            if (!singleMenu) {
                return;
            }
            closeMenus();

            vscode.postMessage({ command: action, commitHash: singleMenu.hash, ...extraArgs });
        },
        [singleMenu, closeMenus],
    );

    const handleRangeAction = useCallback(
        (action: string) => {
            if (!rangeMenu) {
                return;
            }
            const { sortedIndices } = rangeMenu;
            const hashes = sortedIndices.map(i => filteredCommits[i].hash);
            const parentHash = filteredCommits[sortedIndices[sortedIndices.length - 1]].parents[0];
            closeMenus();
            vscode.postMessage({ command: action, hashes, parentHash });
        },
        [rangeMenu, filteredCommits, closeMenus],
    );

    const handleFilesViewModeChange = (mode: "tree" | "list") => {
        setFilesViewMode(mode);
        vscode.postMessage({ command: "saveFilesViewMode", mode });
    };

    const singleMenuCommitTags = useMemo(() => {
        if (!singleMenu)
            return [];
        const commit = filteredCommits.find(c => c.hash === singleMenu.hash);
        return commit?.refs.filter(r => r.startsWith("tag: ")).map(r => r.replace("tag: ", "")) || [];
    }, [singleMenu, filteredCommits]);

    return (
        <div onClick={closeMenus} className="graph-view-container">
            <div className="graph-top-pane">
                <div
                    className="search-wrap"
                    style={{ display: "flex", gap: "8px", padding: "0 8px 8px", flexWrap: "nowrap" }}
                >
                    <div style={{ position: "relative", flex: 1, display: "flex" }}>
                        <input
                            className="search-input"
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoComplete="off"
                            spellCheck={false}
                            onClick={e => e.stopPropagation()}
                            style={{ flex: 1, minWidth: "0", paddingRight: "28px" }}
                        />
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSearch();
                            }}
                            style={{
                                position: "absolute",
                                right: "6px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--vscode-input-foreground, inherit)",
                                opacity: 0.6,
                            }}
                            title="Search"
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="7" cy="7" r="5"></circle>
                                <line x1="11" y1="11" x2="15" y2="15"></line>
                            </svg>
                        </div>
                    </div>
                    <div style={{ position: "relative", flex: 1, display: "flex" }}>
                        <input
                            className="search-input"
                            type="text"
                            placeholder="Author"
                            value={searchAuthor}
                            onChange={e => setSearchAuthor(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoComplete="off"
                            spellCheck={false}
                            onClick={e => e.stopPropagation()}
                            style={{ flex: 1, minWidth: "0", paddingRight: "28px" }}
                        />
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSearch();
                            }}
                            style={{
                                position: "absolute",
                                right: "6px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--vscode-input-foreground, inherit)",
                                opacity: 0.6,
                            }}
                            title="Search"
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="7" cy="7" r="5"></circle>
                                <line x1="11" y1="11" x2="15" y2="15"></line>
                            </svg>
                        </div>
                    </div>
                    <div style={{ position: "relative", flex: 1, display: "flex" }}>
                        <input
                            className="search-input"
                            type="text"
                            placeholder="YYYY/MM/DD (From)"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onClick={e => e.stopPropagation()}
                            style={{ flex: 1, minWidth: "0", paddingRight: "28px" }}
                        />
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSearch();
                            }}
                            style={{
                                position: "absolute",
                                right: "6px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--vscode-input-foreground, inherit)",
                                opacity: 0.6,
                            }}
                            title="Search"
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="7" cy="7" r="5"></circle>
                                <line x1="11" y1="11" x2="15" y2="15"></line>
                            </svg>
                        </div>
                    </div>
                    <div style={{ position: "relative", flex: 1, display: "flex" }}>
                        <input
                            className="search-input"
                            type="text"
                            placeholder="YYYY/MM/DD (To)"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onClick={e => e.stopPropagation()}
                            style={{ flex: 1, minWidth: "0", paddingRight: "28px" }}
                        />
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSearch();
                            }}
                            style={{
                                position: "absolute",
                                right: "6px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--vscode-input-foreground, inherit)",
                                opacity: 0.6,
                            }}
                            title="Search"
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="7" cy="7" r="5"></circle>
                                <line x1="11" y1="11" x2="15" y2="15"></line>
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="branch-info-bar">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span>{branchLabel}</span>
                    </div>
                    {(filterBranch || filterFile) && (
                        <button
                            className="branch-info-close-btn"
                            onClick={() =>
                                vscode.postMessage({
                                    command: filterFile ? "clearFileFilter" : "clearBranchFilter",
                                })}
                            title={filterFile ? "Clear file filter" : "Clear branch filter"}
                        >
                            ×
                        </button>
                    )}
                </div>

                {filteredCommits.length === 0
                    ? (
                            <div className="no-commits">
                                <p>
                                    {!activeSearch.query && !activeSearch.author && !activeSearch.from && !activeSearch.to
                                        ? "No commits found in this repository"
                                        : "No commits match the filters"}
                                </p>
                            </div>
                        )
                    : (
                            <div className="table-container" ref={containerRef}>
                                <table>
                                    <tbody>
                                        {graphNodes.map((node, index) => {
                                            const commit = node.commit;
                                            const isSelected = selectedIndices.has(index);
                                            const isMenuOpen
                                                = singleMenu?.index === index || rangeMenu?.sortedIndices.includes(index);
                                            const singleSelected = selectedIndices.size === 1 && isSelected;
                                            const files = singleSelected ? commitFiles[commit.hash] : null;

                                            return (
                                                <React.Fragment key={commit.hash}>
                                                    <CommitRow
                                                        graphWidth={graphWidth}
                                                        graphNode={node}
                                                        headCommitHash={headCommitHash}
                                                        isSelected={isSelected}
                                                        isMenuOpen={isMenuOpen}
                                                        isLoading={loadingHash === commit.hash}
                                                        isFirst={index === 0}
                                                        isLast={index === filteredCommits.length - 1}
                                                        isDimmed={highlightCurrent && !commit.isCurrentBranch}
                                                        showTags={showTags}
                                                        showRemoteBranches={showRemoteBranches}
                                                        showGraph={showGraph}
                                                        onClick={shiftKey => handleRowClick(index, shiftKey)}
                                                        onContextMenu={e => handleContextMenu(e, index)}
                                                    />
                                                    {singleSelected && (
                                                        <tr className="inline-files-row" onClick={e => e.stopPropagation()}>
                                                            <td colSpan={showGraph ? 5 : 4}>
                                                                <div className="inline-files-container">
                                                                    <div className="inline-files-header">
                                                                        <div
                                                                            style={{
                                                                                display: "flex",
                                                                                alignItems: "center",
                                                                                flex: 1,
                                                                                minWidth: 0,
                                                                            }}
                                                                        >
                                                                            <div
                                                                                style={{
                                                                                    display: "flex",
                                                                                    flexDirection: "column",
                                                                                    gap: "4px",
                                                                                    flex: 1,
                                                                                    minWidth: 0,
                                                                                }}
                                                                            >
                                                                                <span className="inline-files-title">
                                                                                    Files modified in
                                                                                    {" "}
                                                                                    {commit.shortHash}
                                                                                    {" "}
                                                                                    -
                                                                                    {" "}
                                                                                    {commit.message}
                                                                                </span>
                                                                                <span
                                                                                    style={{
                                                                                        fontSize: "11px",
                                                                                        opacity: 0.8,
                                                                                        color: "var(--vscode-descriptionForeground)",
                                                                                    }}
                                                                                >
                                                                                    {commit.author}
                                                                                    {" "}
                                                                                    &lt;
                                                                                    {commit.email}
                                                                                    &gt;
                                                                                </span>
                                                                            </div>
                                                                            <div className="view-toggle">
                                                                                <button
                                                                                    className={`toggle-btn ${filesViewMode === "list" ? "active" : ""}`}
                                                                                    onClick={() =>
                                                                                        handleFilesViewModeChange("list")}
                                                                                    title="List View"
                                                                                >
                                                                                    <svg
                                                                                        width="14"
                                                                                        height="14"
                                                                                        viewBox="0 0 36 36"
                                                                                        fill="currentColor"
                                                                                    >
                                                                                        <path d="M2 8h2v2H2z" />
                                                                                        <path d="M7 10h24a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2" />
                                                                                        <path d="M2 14h2v2H2z" />
                                                                                        <path d="M31 14H7a1 1 0 0 0 0 2h24a1 1 0 0 0 0-2" />
                                                                                        <path d="M2 20h2v2H2z" />
                                                                                        <path d="M31 20H7a1 1 0 0 0 0 2h24a1 1 0 0 0 0-2" />
                                                                                        <path d="M2 26h2v2H2z" />
                                                                                        <path d="M31 26H7a1 1 0 0 0 0 2h24a1 1 0 0 0 0-2" />
                                                                                    </svg>
                                                                                </button>
                                                                                <button
                                                                                    className={`toggle-btn ${filesViewMode === "tree" ? "active" : ""}`}
                                                                                    onClick={() =>
                                                                                        handleFilesViewModeChange("tree")}
                                                                                    title="Tree View"
                                                                                >
                                                                                    <svg
                                                                                        width="14"
                                                                                        height="14"
                                                                                        viewBox="0 0 36 36"
                                                                                        fill="currentColor"
                                                                                    >
                                                                                        <rect width="6" height="6" x="10" y="26" rx="1" ry="1" />
                                                                                        <path d="M15 16h-4a1 1 0 0 0-1 1v1.2H5.8V12H7a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1.2v17.8H11a.8.8 0 1 0 0-1.6H5.8v-8.4H10V21a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1" />
                                                                                        <path d="M33 8H10v2h23a1 1 0 0 0 0-2" />
                                                                                        <path d="M33 18H18v2h15a1 1 0 0 0 0-2" />
                                                                                        <path d="M33 28H18v2h15a1 1 0 0 0 0-2" />
                                                                                    </svg>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            className="close-pane-btn"
                                                                            onClick={() => setSelectedIndices(new Set())}
                                                                        >
                                                                            &#x2715;
                                                                        </button>
                                                                    </div>
                                                                    <div className="inline-files-content">
                                                                        {files
                                                                            ? (
                                                                                    files.length > 0
                                                                                        ? (
                                                                                                filesViewMode === "tree"
                                                                                                    ? (
                                                                                                            <FileTree
                                                                                                                items={files}
                                                                                                                renderLeaf={(path, name, item) => (
                                                                                                                    <div
                                                                                                                        className="file-tree-file"
                                                                                                                        onClick={() =>
                                                                                                                            vscode.postMessage({
                                                                                                                                command: "openDiff",
                                                                                                                                commitHash: commit.hash,
                                                                                                                                parentHash: commit.parents?.[0],
                                                                                                                                filePath: path,
                                                                                                                            })}
                                                                                                                    >
                                                                                                                        <span className={`file-status file-status-${item.status?.toLowerCase()}`}>{item.status}</span>
                                                                                                                        <span className={`file-name file-name-${item.status?.toLowerCase()}`}>{name}</span>
                                                                                                                        {(item.insertions! > 0 || item.deletions! > 0) && (
                                                                                                                            <span className="file-stats">
                                                                                                                                {item.insertions! > 0 && (
                                                                                                                                    <span className="stat-added">
                                                                                                                                        +
                                                                                                                                        {item.insertions}
                                                                                                                                    </span>
                                                                                                                                )}
                                                                                                                                {item.deletions! > 0 && (
                                                                                                                                    <span className="stat-removed">
                                                                                                                                        -
                                                                                                                                        {item.deletions}
                                                                                                                                    </span>
                                                                                                                                )}
                                                                                                                            </span>
                                                                                                                        )}
                                                                                                                        <span
                                                                                                                            className="open-file-btn"
                                                                                                                            title="Open locally"
                                                                                                                            onClick={(e) => {
                                                                                                                                e.stopPropagation();
                                                                                                                                vscode.postMessage({ command: "openFile", filePath: path });
                                                                                                                            }}
                                                                                                                        >
                                                                                                                            ↗
                                                                                                                        </span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            />
                                                                                                        )
                                                                                                    : (
                                                                                                            <FileList
                                                                                                                files={files}
                                                                                                                onOpenDiff={path =>
                                                                                                                    vscode.postMessage({
                                                                                                                        command: "openDiff",
                                                                                                                        commitHash: commit.hash,
                                                                                                                        parentHash: commit.parents?.[0],
                                                                                                                        filePath: path,
                                                                                                                    })}
                                                                                                                onOpenFile={path =>
                                                                                                                    vscode.postMessage({
                                                                                                                        command: "openFile",
                                                                                                                        filePath: path,
                                                                                                                    })}
                                                                                                            />
                                                                                                        )
                                                                                            )
                                                                                        : (
                                                                                                <div className="no-files">No files changed</div>
                                                                                            )
                                                                                )
                                                                            : (
                                                                                    <div className="loading-files">
                                                                                        Loading files...
                                                                                    </div>
                                                                                )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {(hasMore || isLoadingMore) && (
                                    <div className="load-more-container">
                                        <button className="load-more-btn" onClick={handleLoadMore} disabled={isLoadingMore}>
                                            {isLoadingMore ? "Loading..." : "Load More"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
            </div>

            {singleMenu && (
                <>
                    <div
                        ref={ctxMenuRef}
                        className="context-menu"
                        style={{ display: "block", left: singleMenu.x, top: singleMenu.y }}
                        onClick={e => e.stopPropagation()}
                    >
                        {headCommitAncestors.has(singleMenu.hash) && singleMenu.hash === headCommitHash && (
                            <div className="context-menu-item" onClick={() => handleSingleAction("amendCommit")}>
                                Amend Commit
                            </div>
                        )}
                        <div className="context-menu-item" onClick={() => handleSingleAction("cherryPick")}>
                            Cherry-pick to current branch
                        </div>
                        <div className="context-menu-separator" />
                        <div className="context-menu-item" onClick={() => handleSingleAction("copyHash")}>
                            Copy Hash
                        </div>
                        <div
                            className="context-menu-item"
                            onClick={() => {
                                closeMenus();
                                vscode.postMessage({ command: "copyCommitMessage", commitHash: singleMenu.hash, commitMessage: filteredCommits[singleMenu.index].message });
                            }}
                        >
                            Copy Commit Message
                        </div>
                        <div className="context-menu-separator" />
                        {headCommitAncestors.has(singleMenu.hash) && (
                            <div className="context-menu-item" onClick={() => handleSingleAction("revertCommit")}>
                                Revert Commit
                            </div>
                        )}
                        {singleMenu.hash !== headCommitHash && (
                            <div className="context-menu-item" onClick={() => handleSingleAction("resetToCommit")}>
                                Reset to Commit
                            </div>
                        )}
                        {headCommitAncestors.has(singleMenu.hash) && (
                            <div
                                className="context-menu-item context-menu-item--danger"
                                onClick={() => handleSingleAction("dropCommit")}
                            >
                                Drop Commit
                            </div>
                        )}
                        <div className="context-menu-separator" />
                        <div className="context-menu-item" onClick={() => handleSingleAction("newTag")}>
                            New Tag...
                        </div>
                        {singleMenuCommitTags.map(tag => (
                            <div
                                key={tag}
                                className="context-menu-item"
                                onClick={() => handleSingleAction("pushTag", { tagName: tag })}
                            >
                                Push Tag '
                                {tag}
                                '
                            </div>
                        ))}
                        <div className="context-menu-item" onClick={() => handleSingleAction("createBranch")}>
                            New Branch from here...
                        </div>
                    </div>
                </>
            )}

            {rangeMenu && (
                <>
                    <div
                        ref={ctxMenuRef}
                        className="context-menu"
                        style={{ display: "block", left: rangeMenu.x, top: rangeMenu.y }}
                        onClick={e => e.stopPropagation()}
                    >
                        {rangeMenu.consecutive && rangeMenu.hashes.every(h => headCommitAncestors.has(h)) && (
                            <>
                                <div className="context-menu-item" onClick={() => handleRangeAction("squashCommits")}>
                                    Squash Commits
                                </div>
                                <div className="context-menu-separator" />
                            </>
                        )}
                        <div className="context-menu-item" onClick={() => handleRangeAction("cherryPickRange")}>
                            Cherry-pick Commits
                        </div>
                        {rangeMenu.hashes.every(h => headCommitAncestors.has(h)) && (
                            <div className="context-menu-item" onClick={() => handleRangeAction("revertCommits")}>
                                Revert Commits
                            </div>
                        )}
                        {rangeMenu.consecutive && rangeMenu.hashes.every(h => headCommitAncestors.has(h)) && (
                            <>
                                <div className="context-menu-separator" />
                                <div
                                    className="context-menu-item context-menu-item--danger"
                                    onClick={() => handleRangeAction("dropCommits")}
                                >
                                    Drop Commits
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            {showSettings && settingsData && (
                <div
                    className="settings-modal-overlay"
                    onClick={() => setShowSettings(false)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape")
                            setShowSettings(false);
                    }}
                >
                    <div className="settings-modal-content" onClick={e => e.stopPropagation()}>
                        <button
                            className="settings-modal-close"
                            onClick={() => setShowSettings(false)}
                        >
                            ×
                        </button>
                        <SettingsForm data={settingsData} />
                    </div>
                </div>
            )}
        </div>
    );
}
