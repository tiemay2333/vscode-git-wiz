import React, { useState, useMemo } from 'react';
import { vscode } from '../vscodeApi';

interface FileDiff {
    filePath: string;
    added: number;
    removed: number;
    lines: string[];
}

interface FileNode {
    name: string;
    path: string;
    added: number;
    removed: number;
    isDirectory: boolean;
    children?: { [key: string]: FileNode };
}

function buildFileTree(files: FileDiff[]) {
    const root: { [key: string]: FileNode } = {};
    for (const file of files) {
        const parts = file.filePath.split('/');
        let currentLevel = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            if (!currentLevel[part]) {
                currentLevel[part] = {
                    name: part,
                    path: isLast ? file.filePath : parts.slice(0, i + 1).join('/'),
                    isDirectory: !isLast,
                    added: isLast ? file.added : 0,
                    removed: isLast ? file.removed : 0,
                    children: isLast ? undefined : {},
                };
            } else if (!isLast) {
                // Folder already exists, but we might need to add stats?
                // Usually folder stats are sum of children, let's keep it simple for now or sum them.
            }
            
            if (!isLast) {
                currentLevel = currentLevel[part].children!;
            }
        }
    }
    return root;
}

const FileTreeNode = ({
    node,
    level,
    renderDiff,
}: {
    node: FileNode;
    level: number;
    renderDiff: (path: string) => React.ReactNode;
}) => {
    const [expanded, setExpanded] = useState(true);

    if (node.isDirectory) {
        return (
            <div className="file-tree-node-wrapper">
                <div
                    className="file-tree-node folder"
                    style={{ '--tree-level': level } as React.CSSProperties}
                    onClick={() => setExpanded(!expanded)}
                >
                    <span className="chevron" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9658;</span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '6px', opacity: 0.8, flexShrink: 0 }}>
                        <path fillRule="evenodd" clipRule="evenodd" d="M7.71 4H14.5L15 4.5v9l-.5.5H1.5l-.5-.5v-10l.5-.5h5.5l1.21 1z"/>
                    </svg>
                    <span className="file-name">{node.name}</span>
                </div>
                {expanded && node.children && (
                    <div className="file-tree-children">
                        {Object.values(node.children)
                            .sort((a, b) => {
                                if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                                return a.isDirectory ? -1 : 1;
                            })
                            .map((child) => (
                                <FileTreeNode
                                    key={child.name}
                                    node={child}
                                    level={level + 1}
                                    renderDiff={renderDiff}
                                />
                            ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="file-tree-node-wrapper">
            {renderDiff(node.path)}
        </div>
    );
};

const FileTree = ({
    files,
    renderDiff,
}: {
    files: FileDiff[];
    renderDiff: (path: string) => React.ReactNode;
}) => {
    const tree = useMemo(() => buildFileTree(files), [files]);

    return (
        <div className="file-tree">
            {Object.values(tree)
                .sort((a, b) => {
                    if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                    return a.isDirectory ? -1 : 1;
                })
                .map((node) => (
                    <FileTreeNode
                        key={node.name}
                        node={node}
                        level={0}
                        renderDiff={renderDiff}
                    />
                ))}
        </div>
    );
};

function parsePatch(patch: string): FileDiff[] {
    const diffIdx = patch.indexOf('\ndiff --git ');
    if (diffIdx < 0) {
        return [];
    }

    return patch
        .slice(diffIdx + 1)
        .split(/(?=^diff --git )/m)
        .filter((s) => s.trim())
        .map((section) => {
            const lines = section.split('\n');
            const match = lines[0].match(/^diff --git a\/(.*?) b\/(.*)$/);
            const filePath = match ? match[2] : lines[0];
            let added = 0,
                removed = 0;
            lines.forEach((line) => {
                if (line.startsWith('+') && !line.startsWith('+++')) {
                    added++;
                }
                if (line.startsWith('-') && !line.startsWith('---')) {
                    removed++;
                }
            });
            return { filePath, added, removed, lines };
        });
}

function DiffLine({ line }: { line: string }) {
    if (line.startsWith('@@')) {
        return <span className="diff-line diff-hunk">{line}</span>;
    }
    if (line.startsWith('+')) {
        return <span className="diff-line diff-add">{line}</span>;
    }
    if (line.startsWith('-')) {
        return <span className="diff-line diff-del">{line}</span>;
    }
    return <span className="diff-line diff-ctx">{line}</span>;
}

function FileDiffBlock({ diff }: { diff: FileDiff }) {
    const hunkStart = diff.lines.findIndex((line) => line.startsWith('@@'));
    const hunkLines = hunkStart === -1 ? [] : diff.lines.slice(hunkStart);

    return (
        <details open>
            <summary>
                <span className="chevron">&#9658;</span>
                <span className="file-name">{diff.filePath}</span>
                <span className="file-stats">
                    {diff.added > 0 && <span className="added">+{diff.added}</span>}
                    {diff.removed > 0 && <span className="removed">-{diff.removed}</span>}
                </span>
            </summary>
            <pre className="diff-content">
                {hunkLines.map((line, i) => (
                    <DiffLine key={i} line={line} />
                ))}
            </pre>
        </details>
    );
}

interface CopyableProps {
    value: string;
    onCopy: (text: string) => void;
    children: React.ReactNode;
}

function Copyable({ value, onCopy, children }: CopyableProps) {
    return (
        <div className="copyable" title="Click to copy" onClick={() => onCopy(value)}>
            {children}
        </div>
    );
}

export interface CommitDetailsData {
    fullHash: string;
    authorEmail: string;
    authorName: string;
    authorDate: string;
    commitDate: string;
    subject: string;
    body: string;
    patch: string;
}

export function CommitDetailsView({ data }: { data: CommitDetailsData }) {
    const { fullHash, authorEmail, authorName, authorDate, commitDate, subject, body, patch } = data;
    const [toastVisible, setToastVisible] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'tree'>((window as any).__COMMIT_DETAILS_VIEW_MODE__ || 'list');

    const formattedAuthorDate = authorDate ? new Date(authorDate).toLocaleString() : '';
    const formattedCommitDate = commitDate ? new Date(commitDate).toLocaleString() : '';
    const showCommitDate = formattedCommitDate && formattedCommitDate !== formattedAuthorDate;

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setToastVisible(true);
            setTimeout(() => setToastVisible(false), 2000);
        });
    };

    const handleViewModeChange = (mode: 'list' | 'tree') => {
        setViewMode(mode);
        vscode.postMessage({ command: 'saveCommitDetailsViewMode', mode });
    };

    const diffs = parsePatch(patch);
    const diffMap = useMemo(() => {
        const map = new Map<string, FileDiff>();
        diffs.forEach(d => map.set(d.filePath, d));
        return map;
    }, [diffs]);

    const renderDiffBlock = (path: string) => {
        const diff = diffMap.get(path);
        if (!diff) return null;
        return <FileDiffBlock key={path} diff={diff} />;
    };

    return (
        <div className="commit-details-container">
            <header className="commit-header">
                <h1 className="subject">{subject}</h1>
                {body && <div className="body">{body}</div>}
            </header>

            <div className="meta">
                <div className="meta-label">Commit</div>
                <Copyable value={fullHash} onCopy={copyToClipboard}>
                    <div className="meta-value hash">{fullHash}</div>
                </Copyable>

                <div className="meta-label">Author</div>
                <Copyable value={`${authorName} <${authorEmail}>`} onCopy={copyToClipboard}>
                    <div className="meta-value">
                        {authorName} &lt;{authorEmail}&gt;
                    </div>
                </Copyable>

                <div className="meta-label">Date</div>
                <Copyable value={formattedAuthorDate} onCopy={copyToClipboard}>
                    <div className="meta-value">{formattedAuthorDate}</div>
                </Copyable>

                {showCommitDate && (
                    <>
                        <div className="meta-label">Committed</div>
                        <Copyable value={formattedCommitDate} onCopy={copyToClipboard}>
                            <div className="meta-value">{formattedCommitDate}</div>
                        </Copyable>
                    </>
                )}
            </div>

            <div className="section-header">
                <div className="section-title">Changed Files</div>
                <div className="view-toggle">
                    <button 
                        className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => handleViewModeChange('list')}
                        title="List View"
                    >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="evenodd" clipRule="evenodd" d="M2 3h12v1H2V3zm0 4h12v1H2V7zm12 4H2v1h12v-1z"/>
                        </svg>
                    </button>
                    <button 
                        className={`toggle-btn ${viewMode === 'tree' ? 'active' : ''}`}
                        onClick={() => handleViewModeChange('tree')}
                        title="Tree View"
                    >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="evenodd" clipRule="evenodd" d="M1 2v3h1V2h12v12h-3v1h4V1H1v1zm12 12V5H5v9h8zm-1-1H6V6h6v7zM1 9h3V6H1v3zm1 4h3v-3H1v3z"/>
                        </svg>
                    </button>
                </div>
            </div>

            <div className="files-list">
                {diffs.length === 0 ? (
                    <div className="no-changes">No changes found in this commit.</div>
                ) : viewMode === 'tree' ? (
                    <FileTree files={diffs} renderDiff={renderDiffBlock} />
                ) : (
                    diffs.map((diff, i) => <FileDiffBlock key={i} diff={diff} />)
                )}
            </div>

            <div id="copy-toast" className={toastVisible ? 'show' : ''}>
                Copied to clipboard
            </div>
        </div>
    );
}
