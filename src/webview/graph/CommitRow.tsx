import type { GraphNode } from "./graphLayout";
import React from "react";
import { vscode } from "../vscodeApi";

export const COLORS = [
    "#3d9fd4", // blue
    "#d43d3d", // red
    "#3dd45c", // green
    "#d4a13d", // orange
    "#9d3dd4", // purple
    "#3dd4be", // lime
    "#d43d8a", // pink
    "#d4d43d", // yellow
];

function getColor(index: number) {
    return COLORS[index % COLORS.length];
}

interface Props {
    graphWidth: number;
    graphNode: GraphNode;
    headCommitHash: string | undefined;
    isSelected: boolean;
    isMenuOpen?: boolean;
    isLoading?: boolean;
    isFirst: boolean;
    isLast: boolean;
    isDimmed?: boolean;
    isSearchMatch?: boolean;
    isMatchQuery?: boolean;
    isMatchHash?: boolean;
    isMatchAuthor?: boolean;
    showTags?: boolean;
    showRemoteBranches?: boolean;
    showGraph?: boolean;
    onClick: (shiftKey: boolean) => void;
    onContextMenu: (e: React.MouseEvent) => void;
}

function RefBadges({ refs, showTags, showRemoteBranches }: { refs: string[]; showTags?: boolean; showRemoteBranches?: boolean }) {
    if (!refs.length) {
        return null;
    }

    const badges = refs.flatMap((ref, i) => {
        if (ref.startsWith("HEAD -> ")) {
            return [
                <span key={i} className="ref-badge ref-head">
                    {ref.substring(8)}
                </span>,
            ];
        }
        if (ref === "HEAD") {
            return [
                <span key={i} className="ref-badge ref-head">
                    HEAD
                </span>,
            ];
        }
        if (ref.startsWith("tag: ")) {
            if (showTags === false)
                return [];
            return [
                <span key={i} className="ref-badge ref-tag">
                    {ref.substring(5)}
                </span>,
            ];
        }
        if (ref.includes("origin/HEAD") || ref.includes("upstream/HEAD")) {
            return [];
        }
        if (ref.includes("origin/") || ref.includes("upstream/")) {
            if (showRemoteBranches === false)
                return [];
            return [
                <span key={i} className="ref-badge ref-remote">
                    {ref.replace("refs/remotes/", "")}
                </span>,
            ];
        }
        return [
            <span key={i} className="ref-badge ref-branch">
                {ref.replace("refs/heads/", "")}
            </span>,
        ];
    });

    if (!badges.length) {
        return null;
    }

    const MAX_VISIBLE = 4;
    const visible = badges.slice(0, MAX_VISIBLE);
    const overflow = badges.length - MAX_VISIBLE;

    return (
        <div className="refs-container">
            {visible}
            {overflow > 0 && (
                <span className="ref-badge ref-overflow" title={`+${overflow} more ref${overflow > 1 ? "s" : ""}`}>
                    +
                    {overflow}
                </span>
            )}
        </div>
    );
}

export const CommitRow = React.memo(({
    graphWidth,
    graphNode,
    headCommitHash,
    isSelected,
    isMenuOpen,
    isLoading,
    isDimmed,
    showTags,
    showRemoteBranches,
    showGraph,
    isMatchQuery,
    isMatchHash,
    isMatchAuthor,
    onClick,
    onContextMenu,
}: Props) => {
    const commit = graphNode.commit;
    const isHead = commit.hash === headCommitHash;

    const rowClassName = [
        isSelected ? "row-selected" : "",
        isMenuOpen ? "row-menu-open" : "",
        isDimmed ? "row-dimmed" : "",
        isMatchQuery ? "row-search-match-query" : "",
        isMatchHash ? "row-search-match-hash" : "",
        isMatchAuthor ? "row-search-match-author" : "",
    ].filter(Boolean).join(" ") || undefined;

    const spinnerRef = React.useRef<HTMLSpanElement>(null);

    React.useEffect(() => {
        if (commit.verificationStatus !== "pending")
            return;

        const target = spinnerRef.current;
        if (!target)
            return;

        let timeoutId: any;

        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (entry.isIntersecting) {
                timeoutId = setTimeout(() => {
                    vscode.postMessage({
                        command: "reverifyCommit",
                        commitHash: commit.hash,
                    });
                }, 200);
            }
            else {
                clearTimeout(timeoutId);
            }
        }, { threshold: 0.1 });

        observer.observe(target);
        return () => {
            clearTimeout(timeoutId);
            observer.unobserve(target);
            observer.disconnect();
        };
    }, [commit.verificationStatus, commit.hash]);

    const showSpinner = isLoading || commit.verificationStatus === "pending";

    return (
        <tr
            className={rowClassName}
            data-commit-hash={commit.hash}
            onClick={e => onClick(e.shiftKey)}
            onContextMenu={onContextMenu}
        >
            {showGraph !== false && (
                <td className="graph-cell" style={{ width: graphWidth, minWidth: graphWidth, maxWidth: graphWidth }}>
                    <svg width={graphWidth} height="28" style={{ display: "block" }}>
                        {[...graphNode.lines]
                            .sort((a, b) => Math.abs(b.x2 - b.x1) - Math.abs(a.x2 - a.x1))
                            .map((line, i) => {
                                const x1 = 10 + line.x1 * 12;
                                const x2 = 10 + line.x2 * 12;
                                const y1 = line.y1 === 0 ? 0 : line.y1 === 1 ? 14 : 28;
                                const y2 = line.y2 === 0 ? 0 : line.y2 === 1 ? 14 : 28;
                                const color = getColor(line.color);

                                if (line.x1 !== line.x2) {
                                    const yMid = (y1 + y2) / 2;
                                    const d = `M ${x1} ${y1} C ${x1} ${yMid}, ${x2} ${yMid}, ${x2} ${y2}`;
                                    return (
                                        <path
                                            key={i}
                                            d={d}
                                            fill="none"
                                            stroke={color}
                                            strokeWidth="1.5"
                                        />
                                    );
                                }

                                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" />;
                            })}
                        <circle
                            cx={10 + graphNode.x * 12}
                            cy="14"
                            r="3.5"
                            fill={isHead ? "var(--vscode-editor-background)" : getColor(graphNode.color)}
                            stroke={getColor(graphNode.color)}
                            strokeWidth="1.5"
                        />
                        {isHead && <circle cx={10 + graphNode.x * 12} cy="14" r="1.5" fill={getColor(graphNode.color)} />}
                    </svg>
                </td>
            )}
            <td className="message-cell" title={commit.message}>
                <RefBadges refs={commit.refs} showTags={showTags} showRemoteBranches={showRemoteBranches} />
                {commit.verificationStatus === "failed" && (
                    <span className="warning-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 16.3L14.89 3.58a3.43 3.43 0 0 0-5.78 0L1.44 16.3a3 3 0 0 0-.05 3A3.37 3.37 0 0 0 4.33 21h15.34a3.37 3.37 0 0 0 2.94-1.66a3 3 0 0 0-.05-3.04M12 17a1 1 0 1 1 1-1a1 1 0 0 1-1 1m1-4a1 1 0 0 1-2 0V9a1 1 0 0 1 2 0Z"/></svg>
                    </span>
                )}
                <span className="message-text">{commit.message}</span>
                {showSpinner && <span ref={spinnerRef} className="row-loading-spinner" title={commit.verificationStatus === "pending" ? "Verifying commit..." : "Loading files..."}></span>}
            </td>
            <td className="hash-cell">{commit.shortHash}</td>
            <td className="author-cell">{commit.author}</td>
            <td className="date-cell">{commit.date}</td>
        </tr>
    );
});
