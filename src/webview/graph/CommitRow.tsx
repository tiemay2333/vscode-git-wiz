import React, { useRef, useEffect } from 'react';
import { GitCommit } from '../types';
import { GraphNode } from './graphLayout';


const COLORS = [
    '#3d9fd4', // blue
    '#d43d3d', // red
    '#3dd45c', // green
    '#d4a13d', // orange
    '#9d3dd4', // purple
    '#3dd4be', // lime
    '#d43d8a', // pink
    '#d4d43d', // yellow
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
    isEditing: boolean;
    isFirst: boolean;
    isLast: boolean;
    onClick: (shiftKey: boolean) => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onEditConfirm: (newMessage: string) => void;
    onEditCancel: () => void;
}

function RefBadges({ refs }: { refs: string[] }) {
    if (!refs.length) {
        return null;
    }

    const badges = refs.flatMap((ref, i) => {
        if (ref.startsWith('HEAD -> ')) {
            return [
                <span key={i} className="ref-badge ref-head">
                    {ref.substring(8)}
                </span>,
            ];
        }
        if (ref === 'HEAD') {
            return [
                <span key={i} className="ref-badge ref-head">
                    HEAD
                </span>,
            ];
        }
        if (ref.startsWith('tag: ')) {
            return [
                <span key={i} className="ref-badge ref-tag">
                    {ref.substring(5)}
                </span>,
            ];
        }
        if (ref.includes('origin/HEAD') || ref.includes('upstream/HEAD')) {
            return [];
        }
        if (ref.includes('origin/') || ref.includes('upstream/')) {
            return [
                <span key={i} className="ref-badge ref-remote">
                    {ref.replace('refs/remotes/', '')}
                </span>,
            ];
        }
        return [
            <span key={i} className="ref-badge ref-branch">
                {ref.replace('refs/heads/', '')}
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
                <span className="ref-badge ref-overflow" title={`+${overflow} more ref${overflow > 1 ? 's' : ''}`}>
                    +{overflow}
                </span>
            )}
        </div>
    );
}

export const CommitRow = React.memo(function CommitRow({
    graphWidth,
    graphNode,
    headCommitHash,
    isSelected,
    isMenuOpen,
    isEditing,
    isFirst,
    isLast,
    onClick,
    onContextMenu,
    onEditConfirm,
    onEditCancel,
}: Props) {
    const commit = graphNode.commit;
    const inputRef = useRef<HTMLInputElement>(null);
    const isHead = commit.hash === headCommitHash;

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    return (
        <tr
            className={isSelected ? 'row-selected' : isMenuOpen ? 'row-menu-open' : undefined}
            data-commit-hash={commit.hash}
            onClick={(e) => onClick(e.shiftKey)}
            onContextMenu={onContextMenu}
        >
            <td className="graph-cell" style={{ width: graphWidth, minWidth: graphWidth, maxWidth: graphWidth }}>
                <svg width={graphWidth} height="28" style={{ display: 'block' }}>
                    {graphNode.lines.map((line, i) => {
                        const x1 = 10 + line.x1 * 12;
                        const x2 = 10 + line.x2 * 12;
                        const y1 = line.y1 === 0 ? 0 : line.y1 === 1 ? 14 : 28;
                        const y2 = line.y2 === 0 ? 0 : line.y2 === 1 ? 14 : 28;
                        const color = getColor(line.color);
                        
                        if (line.x1 !== line.x2) {
                            const cx1 = x1;
                            const cy1 = (y1 + y2) / 2;
                            const cx2 = x2;
                            const cy2 = (y1 + y2) / 2;
                            return <path key={i} d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`} fill="none" stroke={color} strokeWidth="1.5" />;
                        }

                        return (
                            <line
                                key={i}
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke={color}
                                strokeWidth="1.5"
                            />
                        );
                    })}
                    <circle 
                        cx={10 + graphNode.x * 12} 
                        cy="14" 
                        r="3.5" 
                        fill={isHead ? 'var(--vscode-editor-background)' : getColor(graphNode.color)} 
                        stroke={getColor(graphNode.color)} 
                        strokeWidth="1.5" 
                    />
                    {isHead && <circle cx={10 + graphNode.x * 12} cy="14" r="1.5" fill={getColor(graphNode.color)} />}
                </svg>
            </td>
            <td className="message-cell" title={commit.message}>
                <RefBadges refs={commit.refs} />
                {isEditing ? (
                    <input
                        ref={inputRef}
                        className="message-edit-input"
                        defaultValue={commit.message}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onEditConfirm(e.currentTarget.value.trim());
                            }
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                onEditCancel();
                            }
                        }}
                        onBlur={onEditCancel}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="message-text">{commit.message}</span>
                )}
            </td>
            <td className="hash-cell">{commit.shortHash}</td>
            <td className="author-cell">{commit.author}</td>
            <td className="date-cell">{commit.date}</td>
        </tr>
    );
});
