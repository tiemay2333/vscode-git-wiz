import type { FileTreeItem, FileTreeNodeData } from "./fileTreeUtils";
import React, { useMemo, useState } from "react";
import { getFileTree, sortEntries } from "./fileTreeUtils.js";

export type { FileTreeItem };

export function FileTree({
    items,
    renderLeaf,
}: {
    items: FileTreeItem[];
    renderLeaf: (path: string, name: string, item: FileTreeNodeData) => React.ReactNode;
}) {
    const tree = useMemo(() => getFileTree(items), [items]);

    return (
        <div className="file-tree">
            {tree.map(node => (
                <FileTreeNode
                    key={node.name}
                    node={node}
                    level={0}
                    renderLeaf={renderLeaf}
                />
            ))}
        </div>
    );
}

function FileTreeNode({
    node,
    level,
    renderLeaf,
}: {
    node: FileTreeNodeData;
    level: number;
    renderLeaf: (path: string, name: string, item: FileTreeNodeData) => React.ReactNode;
}) {
    const [expanded, setExpanded] = useState(true);

    if (node.isDirectory) {
        return (
            <div className="file-tree-node-wrapper">
                <div
                    className="file-tree-node"
                    style={{ "--tree-level": level } as React.CSSProperties}
                    onClick={() => setExpanded(!expanded)}
                >
                    <span className="file-tree-folder">
                        <span className="file-tree-folder-icon">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                    transition: "transform 0.15s ease",
                                    transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                                }}
                            >
                                <path d="M6 4L10 8L6 12" />
                            </svg>
                        </span>
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            style={{ marginRight: "6px", opacity: 0.8, flexShrink: 0 }}
                        >
                            <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M7.71 4H14.5L15 4.5v9l-.5.5H1.5l-.5-.5v-10l.5-.5h5.5l1.21 1z"
                            />
                        </svg>
                        {node.name}
                    </span>
                </div>
                {expanded && (
                    <div className="file-tree-children">
                        {sortEntries(Object.values(node.children)).map(child => (
                            <FileTreeNode
                                key={child.name}
                                node={child}
                                level={level + 1}
                                renderLeaf={renderLeaf}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="file-tree-node-wrapper">
            <div
                className="file-tree-node"
                style={{ "--tree-level": level } as React.CSSProperties}
            >
                {renderLeaf(node.path, node.name, node)}
            </div>
        </div>
    );
}
