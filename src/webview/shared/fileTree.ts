export interface FileTreeItem {
    path: string;
    status?: string;
    insertions?: number;
    deletions?: number;
}

export interface FileTreeNodeData {
    name: string;
    path: string;
    status?: string;
    insertions?: number;
    deletions?: number;
    isDirectory: boolean;
    children: Record<string, FileTreeNodeData>;
}

export function sortEntries(nodes: FileTreeNodeData[]): FileTreeNodeData[] {
    nodes.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
            return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
    });
    return nodes;
}

export function getFileTree(items: FileTreeItem[]): FileTreeNodeData[] {
    const root: Record<string, FileTreeNodeData> = {};
    for (const item of items) {
        const parts = item.path.split("/");
        let currentLevel = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            if (!currentLevel[part]) {
                currentLevel[part] = {
                    name: part,
                    path: isLast ? item.path : parts.slice(0, i + 1).join("/"),
                    isDirectory: !isLast,
                    status: isLast ? item.status : undefined,
                    insertions: isLast ? item.insertions : undefined,
                    deletions: isLast ? item.deletions : undefined,
                    children: {},
                };
            }
            if (!isLast) {
                currentLevel = currentLevel[part].children;
            }
        }
    }

    return sortEntries(Object.values(root));
}
