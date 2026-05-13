import type { GraphNode } from "./graphLayout";
import React from "react";

const COLORS = [
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
                {commit.verificationStatus === "pending" && (
                    <span
                        className="verification-pending-icon"
                        title="Current Branch Matching: Metadata matched, verifying content similarity..."
                        style={{
                            marginRight: "4px",
                            color: "#d4a13d",
                            display: "inline-flex",
                            alignItems: "center",
                            verticalAlign: "middle",
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-1A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0c0 1.054-.35 1.522-.925 2.015-.58.496-.975.867-1.1 1.49a.5.5 0 1 1-.975-.19c.187-1 1-1.353 1.455-1.742.42-.36.545-.643.545-.968z" />
                        </svg>
                    </span>
                )}
                <span className="message-text">{commit.message}</span>
                {isLoading && <span className="row-loading-spinner" title="Loading files..."></span>}
            </td>
            <td className="hash-cell">{commit.shortHash}</td>
            <td className="author-cell">{commit.author}</td>
            <td className="date-cell">{commit.date}</td>
        </tr>
    );
});
