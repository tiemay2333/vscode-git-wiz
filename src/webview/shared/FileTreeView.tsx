import type { FileTreeItem, FileTreeNodeData } from "./fileTreeUtils";
import React, { useMemo, useState } from "react";
import { getFileTree, sortEntries } from "./fileTreeUtils.js";
import { IconChevronSmall, IconFolderSmall } from "./Icons";

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
                            <IconChevronSmall
                                style={{
                                    transition: "transform 0.15s ease",
                                    transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                                }}
                            />
                        </span>
                        <IconFolderSmall style={{ marginRight: "6px", opacity: 0.8, flexShrink: 0 }} />
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
