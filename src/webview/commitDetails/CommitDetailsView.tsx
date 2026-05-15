import React, { useMemo, useState } from "react";
import { FileTree } from "../shared/FileTreeView";
import { IconList, IconTree } from "../shared/Icons";
import { vscode } from "../vscodeApi";

interface FileDiff {
    filePath: string;
    added: number;
    removed: number;
    lines: string[];
}

function parsePatch(patch: string): FileDiff[] {
    const diffIdx = patch.indexOf("\ndiff --git ");
    if (diffIdx < 0) {
        return [];
    }

    return patch
        .slice(diffIdx + 1)
        .split(/(?=^diff --git )/m)
        .filter(s => s.trim())
        .map((section) => {
            const lines = section.split("\n");
            const match = lines[0].match(/^diff --git a\/(.*?) b\/(.*)$/);
            const filePath = match ? match[2] : lines[0];
            let added = 0;
            let removed = 0;
            lines.forEach((line) => {
                if (line.startsWith("+") && !line.startsWith("+++")) {
                    added++;
                }
                if (line.startsWith("-") && !line.startsWith("---")) {
                    removed++;
                }
            });
            return { filePath, added, removed, lines };
        });
}

function DiffLine({ line }: { line: string }) {
    if (line.startsWith("@@")) {
        return <span className="diff-line diff-hunk">{line}</span>;
    }
    if (line.startsWith("+")) {
        return <span className="diff-line diff-add">{line}</span>;
    }
    if (line.startsWith("-")) {
        return <span className="diff-line diff-del">{line}</span>;
    }
    return <span className="diff-line diff-ctx">{line}</span>;
}

function FileDiffBlock({ diff }: { diff: FileDiff }) {
    const hunkStart = diff.lines.findIndex(line => line.startsWith("@@"));
    const hunkLines = hunkStart === -1 ? [] : diff.lines.slice(hunkStart);

    return (
        <details open>
            <summary>
                <span className="chevron">&#9658;</span>
                <span className="file-name">{diff.filePath}</span>
                <span className="file-stats">
                    {diff.added > 0 && (
                        <span className="added">
                            +
                            {diff.added}
                        </span>
                    )}
                    {diff.removed > 0 && (
                        <span className="removed">
                            -
                            {diff.removed}
                        </span>
                    )}
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
    const [viewMode, setViewMode] = useState<"list" | "tree">(
        (window as unknown as { __COMMIT_DETAILS_VIEW_MODE__?: "list" | "tree" }).__COMMIT_DETAILS_VIEW_MODE__ || "list",
    );

    const formattedAuthorDate = authorDate ? new Date(authorDate).toLocaleString() : "";
    const formattedCommitDate = commitDate ? new Date(commitDate).toLocaleString() : "";
    const showCommitDate = formattedCommitDate && formattedCommitDate !== formattedAuthorDate;

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setToastVisible(true);
            setTimeout(setToastVisible, 2000, false);
        });
    };

    const handleViewModeChange = (mode: "list" | "tree") => {
        setViewMode(mode);
        vscode.postMessage({ command: "saveCommitDetailsViewMode", mode });
    };

    const diffs = parsePatch(patch);
    const diffMap = useMemo(() => {
        const map = new Map<string, FileDiff>();
        diffs.forEach(d => map.set(d.filePath, d));
        return map;
    }, [diffs]);

    const treeItems = useMemo(() => diffs.map(d => ({
        path: d.filePath,
        insertions: d.added,
        deletions: d.removed,
    })), [diffs]);

    const renderDiffBlock = (path: string) => {
        const diff = diffMap.get(path);
        if (!diff)
            return null;
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
                        {authorName}
                        {" "}
                        &lt;
                        {authorEmail}
                        &gt;
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
                        className={`toggle-btn ${viewMode === "list" ? "active" : ""}`}
                        onClick={() => handleViewModeChange("list")}
                        title="List View"
                    >
                        <IconList />
                    </button>
                    <button
                        className={`toggle-btn ${viewMode === "tree" ? "active" : ""}`}
                        onClick={() => handleViewModeChange("tree")}
                        title="Tree View"
                    >
                        <IconTree />
                    </button>
                </div>
            </div>

            <div className="files-list">
                {diffs.length === 0
                    ? (
                            <div className="no-changes">No changes found in this commit.</div>
                        )
                    : viewMode === "tree"
                        ? (
                                <FileTree items={treeItems} renderLeaf={path => renderDiffBlock(path)} />
                            )
                        : (
                                diffs.map((diff, i) => <FileDiffBlock key={i} diff={diff} />)
                            )}
            </div>

            <div id="copy-toast" className={toastVisible ? "show" : ""}>
                Copied to clipboard
            </div>
        </div>
    );
}
