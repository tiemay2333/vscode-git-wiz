import * as vscode from 'vscode';
import { GitCommit } from './gitOperations';

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

function safeJson(value: unknown): string {
    return JSON.stringify(value).replace(/<\//g, '<\\/');
}

function getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}

export function getHtmlForWebview(
    webview: vscode.Webview,
    commits: GitCommit[],
    branches: any[],
    hasMore: boolean,
    filterBranch: string | null,
    currentBranch: string | null,
    extensionUri: vscode.Uri,
    filesViewMode: 'list' | 'tree' = 'list',
    filterFile: string | null = null,
): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'index.js'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
    <title>Tree</title>
    <style>
        * { box-sizing: border-box; }
        html, body { overflow-x: hidden; }
        body {
            font-family: var(--vscode-font-family);
            font-weight: 500;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 0;
            margin: 0;
            -webkit-font-smoothing: antialiased;
        }
        .table-container { overflow-x: hidden; padding: 0 10px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
        td { padding: 3px 6px; vertical-align: middle; }
        tbody tr:hover { background-color: var(--vscode-list-hoverBackground); }
        tbody tr { cursor: pointer; }
        .graph-cell { padding: 0; vertical-align: middle; /* dynamic width from react */ }
        .graph-canvas { display: block; }
        .hash-cell {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-descriptionForeground);
            font-size: 10.5px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 76px;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.03em;
            opacity: 0.65;
            padding-left: 8px;
            text-align: right;
        }
        .message-cell { font-size: 12px; display: flex; align-items: center; gap: 5px; overflow: hidden; padding: 3px 8px 3px 2px; height: 28px; }
        .message-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
        .refs-container { display: flex; gap: 3px; flex-shrink: 0; align-items: center; }
        .ref-badge {
            display: inline-flex;
            align-items: center;
            height: 16px;
            padding: 0 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            border: 1px solid;
            letter-spacing: 0.01em;
        }
        .ref-head {
            background-color: var(--vscode-gitDecoration-modifiedResourceForeground);
            border-color: var(--vscode-gitDecoration-modifiedResourceForeground);
            color: var(--vscode-editor-background);
            font-weight: 700;
        }
        .ref-branch {
            background-color: transparent;
            border-color: var(--vscode-gitDecoration-addedResourceForeground);
            color: var(--vscode-gitDecoration-addedResourceForeground);
        }
        .ref-remote {
            background-color: transparent;
            border-color: var(--vscode-gitDecoration-untrackedResourceForeground);
            color: var(--vscode-gitDecoration-untrackedResourceForeground);
            opacity: 0.8;
        }
        .ref-tag {
            background-color: transparent;
            border-color: var(--vscode-gitDecoration-submoduleResourceForeground);
            color: var(--vscode-gitDecoration-submoduleResourceForeground);
        }
        .ref-overflow {
            background-color: transparent;
            border-color: var(--vscode-descriptionForeground);
            color: var(--vscode-descriptionForeground);
            opacity: 0.55;
            font-variant-numeric: tabular-nums;
            cursor: default;
        }
        .author-cell {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            opacity: 0.85;
            width: 100px;
            padding-left: 12px;
        }
        .date-cell {
            white-space: nowrap;
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            width: 130px;
            overflow: visible;
            font-variant-numeric: tabular-nums;
            opacity: 0.85;
            padding-right: 10px;
            text-align: right;
        }
        .no-commits { text-align: center; padding: 48px 20px; color: var(--vscode-descriptionForeground); font-size: 13px; }
        .search-wrap {
            padding: 0 8px 10px;
            position: sticky;
            top: 0;
            background: var(--vscode-editor-background);
            z-index: 10;
        }
        .search-input {
            width: 100%;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.25));
            padding: 5px 8px;
            font-size: var(--vscode-font-size);
            font-family: var(--vscode-font-family);
            outline: none;
            border-radius: 4px;
            box-sizing: border-box;
            transition: border-color 0.15s ease;
        }
        .search-input:focus { border-color: var(--vscode-focusBorder); }
        .search-input::placeholder { color: var(--vscode-input-placeholderForeground, rgba(128,128,128,0.45)); }
        .context-menu {
            position: fixed;
            background-color: var(--vscode-menu-background);
            border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
            border-radius: 6px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 200px;
            display: none;
            padding: 4px 0;
            overflow-y: auto;
            overflow-x: hidden;
        }
        .context-menu-item {
            padding: 6px 18px;
            cursor: pointer;
            color: var(--vscode-menu-foreground);
            font-size: 12.5px;
            display: flex;
            align-items: center;
            gap: 8px;
            user-select: none;
            transition: background-color 0.08s ease;
        }
        .context-menu-item:hover {
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-list-hoverForeground);
        }
        .context-menu-item--danger {
            color: var(--vscode-errorForeground);
        }
        .context-menu-item--danger:hover {
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-errorForeground);
        }
        .context-menu-separator { height: 1px; background-color: var(--vscode-panel-border); margin: 3px 6px; }
        .message-edit-input {
            flex: 1;
            min-width: 0;
            background: transparent;
            border: none;
            border-bottom: 1.5px solid var(--vscode-focusBorder);
            color: inherit;
            font: inherit;
            font-size: 12px;
            outline: none;
            padding: 0;
        }
        tr.row-selected {
            background-color: var(--vscode-list-activeSelectionBackground);
            box-shadow: inset 4px 0 0 var(--vscode-focusBorder);
        }
        tr.row-selected td {
            border-bottom: none !important;
        }
        tr.row-selected:hover { background-color: var(--vscode-list-activeSelectionBackground); }
        tr.row-menu-open {
            background-color: var(--vscode-list-hoverBackground);
        }

        /* Graph Layout */
        
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .row-loading-spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-top-color: #007aff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-left: 8px;
            flex-shrink: 0;
        }

        .graph-view-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
            background: var(--vscode-editor-background);
        }
        .graph-top-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
            background: transparent;
        }
        .graph-top-pane .table-container {
            flex: 1;
            overflow-y: auto;
        }

        .branch-info-bar {
            padding: 6px 12px;
            font-size: 11px;
            font-weight: 500;
            color: var(--vscode-descriptionForeground);
            border-bottom: 1px solid var(--vscode-panel-border);
            flex-shrink: 0;
        }
        .branch-info-close-btn {
            background: none;
            border: none;
            color: var(--vscode-errorForeground);
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            padding: 3px 6px;
            line-height: 1;
            border-radius: 4px;
            transition: background 0.15s ease, color 0.15s ease;
        }
        .branch-info-close-btn:hover {
            background: color-mix(in srgb, var(--vscode-editor-foreground) 10%, transparent);
        }

        /* Inline Files View */
        .inline-files-row {
            background-color: transparent !important;
            cursor: default !important;
        }
        .inline-files-row:hover {
            background-color: transparent !important;
        }
        .inline-files-row td {
            padding: 0 !important;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .inline-files-container {
            display: flex;
            flex-direction: column;
            padding: 12px 32px;
            box-shadow: inset 4px 0 0 var(--vscode-focusBorder);
        }
        .inline-files-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .inline-files-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--vscode-descriptionForeground);
            opacity: 0.8;
        }
        .view-toggle {
            display: flex;
            gap: 4px;
            margin-left: 12px;
            background: var(--vscode-editor-background);
            padding: 2px;
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }
        .toggle-btn {
            background: none;
            border: none;
            color: var(--vscode-descriptionForeground);
            padding: 2px 4px;
            cursor: pointer;
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            transition: all 0.15s ease;
        }
        .toggle-btn:hover {
            opacity: 1;
            background: var(--vscode-list-hoverBackground);
        }
        .toggle-btn.active {
            opacity: 1;
            color: var(--vscode-button-foreground);
            background: var(--vscode-button-background);
        }
        .close-pane-btn {
            background: none;
            border: none;
            color: var(--vscode-icon-foreground);
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            padding: 2px 6px;
            border-radius: 4px;
            transition: background 0.15s ease, color 0.15s ease;
            margin-left: 8px;
        }
        .close-pane-btn:hover {
            color: var(--vscode-foreground);
            background: color-mix(in srgb, var(--vscode-editor-foreground) 10%, transparent);
        }
        .inline-files-content {
            font-family: var(--vscode-editor-font-family);
        }
        .file-tree, .file-list {
            display: flex;
            flex-direction: column;
        }
        .file-tree-node, .file-list-item {
            display: flex;
            align-items: center;
            padding: 0px 8px;
            padding-left: calc(8px + var(--tree-level, 0) * 18px);
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.15s ease;
            font-size: 12px;
            margin-bottom: 0px;
            height: 22px; /* Ensuring file and folder nodes have consistent height */
        }
        .file-tree-node:hover, .file-list-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .file-tree-node:hover .open-file-btn, .file-list-item:hover .open-file-btn {
            opacity: 1;
        }
        .file-tree-folder {
            color: var(--vscode-foreground);
            font-weight: 600;
            display: flex;
            align-items: center;
        }
        .file-tree-folder-icon {
            width: 20px;
            text-align: center;
            margin-right: 4px;
            font-size: 16px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.8;
            color: var(--vscode-symbolIcon-folderForeground);
        }
        .file-tree-file, .file-list-file {
            display: flex;
            align-items: center;
            flex: 1;
            min-width: 0;
            font-weight: 600;
        }
        .file-status {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 1px 6px 1px 0px;
            border-radius: 12px; /* Apple-style pill */
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            width: 26px; /* fixed width for alignment */
        }
        .file-status.status-a { 
            color: var(--vscode-gitDecoration-addedResourceForeground);
            background-color: color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground) 15%, transparent);
        }
        .file-status.status-m { 
            color: var(--vscode-gitDecoration-modifiedResourceForeground);
            background-color: color-mix(in srgb, var(--vscode-gitDecoration-modifiedResourceForeground) 15%, transparent);
        }
        .file-status.status-d { 
            color: var(--vscode-gitDecoration-deletedResourceForeground);
            background-color: color-mix(in srgb, var(--vscode-gitDecoration-deletedResourceForeground) 15%, transparent);
        }
        .file-status.status-r { 
            color: var(--vscode-gitDecoration-renamedResourceForeground);
            background-color: color-mix(in srgb, var(--vscode-gitDecoration-renamedResourceForeground) 15%, transparent);
        }
        .file-name {
            flex: 1;
            color: var(--vscode-foreground);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            padding-right: 12px;
        }
        .file-name.file-name-a { color: var(--vscode-gitDecoration-addedResourceForeground); }
        .file-name.file-name-m { color: var(--vscode-gitDecoration-modifiedResourceForeground); }
        .file-name.file-name-d { color: var(--vscode-gitDecoration-deletedResourceForeground); text-decoration: line-through; opacity: 0.6; }
        .file-name.file-name-r { color: var(--vscode-gitDecoration-renamedResourceForeground); }
        .file-stats {
            display: inline-flex;
            align-items: center;
            justify-content: flex-end;
            min-width: 64px;
            font-size: 11px;
            font-family: var(--vscode-editor-font-family);
            font-weight: 600;
            opacity: 0.8;
            margin-right: 12px;
            gap: 8px;
        }
        .stat-added {
            color: var(--vscode-gitDecoration-addedResourceForeground);
        }
        .stat-removed {
            color: var(--vscode-gitDecoration-deletedResourceForeground);
        }
        .open-file-btn {
            opacity: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            padding-bottom: 3px;
            border-radius: 4px;
            color: var(--vscode-descriptionForeground);
            font-weight: normal;
            font-size: 14px;
            transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
            background-color: transparent;
        }
        .open-file-btn:hover {
            color: var(--vscode-foreground);
            background-color: color-mix(in srgb, var(--vscode-editor-foreground) 10%, transparent);
        }
        .no-files, .loading-files {
            padding: 24px;
            text-align: center;
            font-size: 11.5px;
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
            font-family: var(--vscode-editor-font-family);
        }
        .load-more-container {
            padding: 20px;
            display: flex;
            justify-content: center;
            border-top: 1px solid var(--vscode-panel-border);
        }
        .load-more-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 14px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
        }
        .load-more-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .load-more-btn:disabled {
            opacity: 0.5;
            cursor: default;
        }

        /* --- Branch Webview Styles --- */
        .section { margin-bottom: 2px; }
        .section-header {
            display: flex;
            align-items: center;
            gap: 3px;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
            cursor: pointer;
            user-select: none;
        }
        .section-header:hover { background: var(--vscode-list-hoverBackground); }
        .section-chevron {
            display: flex;
            align-items: center;
            flex-shrink: 0;
            opacity: 0.55;
        }
        .group-row {
            display: flex;
            align-items: center;
            gap: 6px;
            padding-top: 2px;
            padding-bottom: 2px;
            padding-right: 8px;
            min-height: 22px;
            cursor: pointer;
            user-select: none;
        }
        .group-row:hover { background: var(--vscode-list-hoverBackground); }
        .row-chevron {
            display: flex;
            align-items: center;
            flex-shrink: 0;
            opacity: 0.45;
        }
        .branch-row {
            display: flex;
            align-items: center;
            gap: 6px;
            padding-top: 2px;
            padding-bottom: 2px;
            padding-right: 8px;
            min-height: 22px;
            cursor: pointer;
            user-select: none;
            transition: background 0.07s ease;
        }
        .branch-row:hover, .branch-row.context-open { background: var(--vscode-list-hoverBackground); }
        .branch-row.selected {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }
        .group-row:hover, .group-row.context-open { background: var(--vscode-list-hoverBackground); }
        .branch-row.is-head {
            border-left: 2px solid var(--vscode-gitDecoration-modifiedResourceForeground);
        }
        .branch-row.is-head .row-label {
            color: var(--vscode-gitDecoration-modifiedResourceForeground);
            font-weight: 600;
        }
        .branch-row.is-head.selected .row-label { color: inherit; }
        .row-label {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 12px;
            font-weight: 600;
        }
        .icon-star { flex-shrink: 0; }
        .icon-tag { flex-shrink: 0; }
        .icon-folder { flex-shrink: 0; opacity: 0.65; }
        .icon-branch { flex-shrink: 0; opacity: 0.6; }
        .branch-row.selected svg { opacity: 1; }
        .empty { padding: 10px 12px; opacity: 0.5; font-style: italic; font-size: 12px; }
        .ctx-menu {
            position: fixed;
            background: var(--vscode-menu-background);
            border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
            border-radius: 6px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 200px;
            padding: 4px 0;
            overflow-x: hidden;
            overflow-y: auto;
        }
        .ctx-item {
            padding: 6px 18px;
            cursor: pointer;
            color: var(--vscode-menu-foreground);
            font-size: 12.5px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
            user-select: none;
            white-space: nowrap;
            transition: background-color 0.08s ease;
        }
        .ctx-item:hover {
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-list-hoverForeground);
        }
        .ctx-sep { height: 1px; background-color: var(--vscode-panel-border); margin: 3px 6px; }
        .ctx-item-danger { color: var(--vscode-errorForeground); }
        .ctx-item-danger:hover { 
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-errorForeground); 
        }
        .branch-row.multi-selected {
            background: var(--vscode-list-inactiveSelectionBackground);
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">window.__VIEW__ = 'graph'; window.__COMMITS__ = ${safeJson(commits)}; window.__BRANCHES__ = ${safeJson(branches)}; window.__HAS_MORE__ = ${hasMore}; window.__FILTER_BRANCH__ = ${safeJson(filterBranch)}; window.__CURRENT_BRANCH__ = ${safeJson(currentBranch)}; window.__FILES_VIEW_MODE__ = ${safeJson(filesViewMode)}; window.__FILTER_FILE__ = ${safeJson(filterFile)};</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

export function getCommitDetailsHtml(
    webview: vscode.Webview,
    data: CommitDetailsData,
    extensionUri: vscode.Uri,
    viewMode: 'list' | 'tree' = 'list',
): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'index.js'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
<title>Commit ${data.fullHash.substring(0, 7)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    font-size: 13px;
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
    margin: 0;
    padding: 24px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .subject {
    font-size: 17px;
    font-weight: 600;
    margin: 0 0 8px;
    line-height: 1.3;
    color: var(--vscode-editor-foreground);
    overflow-wrap: break-word;
  }
  .body {
    color: var(--vscode-descriptionForeground);
    font-size: 13px;
    margin: 0 0 24px;
    white-space: pre-wrap;
    line-height: 1.6;
    border-left: 2px solid var(--vscode-panel-border);
    padding-left: 12px;
  }
  .meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 16px;
    margin-bottom: 32px;
    padding: 16px;
    background-color: var(--vscode-editor-inactiveSelectionBackground, rgba(128,128,128,0.1));
    border-radius: 6px;
    border: 1px solid var(--vscode-panel-border);
  }
  .meta-label {
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.6;
  }
  .meta-value { 
    word-break: break-all;
    font-size: 12px;
  }
  .meta-value.hash {
    font-family: var(--vscode-editor-font-family);
    color: var(--vscode-textPreformat-foreground);
    font-variant-numeric: tabular-nums;
  }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--vscode-descriptionForeground);
    margin: 32px 0 12px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: var(--vscode-panel-border);
    opacity: 0.5;
  }
  details {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    margin-bottom: 12px;
    overflow: hidden;
    background-color: var(--vscode-editor-background);
    transition: box-shadow 0.2s ease;
  }
  details:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    border-color: var(--vscode-focusBorder);
  }
  summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    cursor: pointer;
    font-size: 12px;
    font-family: var(--vscode-editor-font-family);
    font-weight: 600;
    list-style: none;
    user-select: none;
    background-color: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-bottom: 1px solid transparent;
  }
  details[open] summary {
    border-bottom-color: var(--vscode-panel-border);
    background-color: var(--vscode-list-hoverBackground);
  }
  summary:hover { background-color: var(--vscode-list-hoverBackground); }
  summary::-webkit-details-marker { display: none; }
  .chevron {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0.5;
    flex-shrink: 0;
  }
  details[open] .chevron { transform: rotate(90deg); }
  .file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-stats { 
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    font-family: var(--vscode-editor-font-family);
    font-size: 11px;
  }
  .added { color: var(--vscode-gitDecoration-addedResourceForeground); }
  .removed { color: var(--vscode-gitDecoration-deletedResourceForeground); }
  pre.diff-content {
    margin: 0;
    padding: 8px 0;
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
    overflow-x: auto;
    line-height: 1.6;
    background-color: var(--vscode-editor-background);
  }
  .diff-line { 
    display: block; 
    padding: 0 16px; 
    white-space: pre; 
    border-left: 3px solid transparent;
  }
  .diff-add {
    background-color: var(--vscode-diffEditor-insertedLineBackground, rgba(70,150,70,0.15));
    border-left-color: var(--vscode-gitDecoration-addedResourceForeground);
  }
  .diff-del {
    background-color: var(--vscode-diffEditor-removedLineBackground, rgba(150,70,70,0.15));
    border-left-color: var(--vscode-gitDecoration-deletedResourceForeground);
  }
  .diff-hunk {
    color: var(--vscode-descriptionForeground);
    font-weight: 600;
    background-color: var(--vscode-editor-hoverHighlightBackground, rgba(128,128,128,0.1));
    opacity: 0.8;
  }
  .diff-ctx { color: var(--vscode-foreground); opacity: 0.9; }
  .no-changes { color: var(--vscode-descriptionForeground); font-size: 13px; padding: 20px 0; text-align: center; }
  .copyable {
    cursor: pointer;
    border-radius: 4px;
    padding: 2px 4px;
    margin: -2px -4px;
    transition: background-color 0.15s ease, color 0.15s ease;
  }
  .copyable:hover { 
    background-color: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
  }
  #copy-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background-color: var(--vscode-notifications-background, var(--vscode-editorWidget-background));
    border: 1px solid var(--vscode-notifications-border, var(--vscode-panel-border));
    color: var(--vscode-notifications-foreground, var(--vscode-foreground));
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.2s ease, transform 0.2s ease;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 1000;
  }
  #copy-toast.show { 
    opacity: 1; 
    transform: translateY(0);
  }
</style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">window.__VIEW__ = 'commitDetails'; window.__COMMIT_DETAILS__ = ${safeJson(data)}; window.__COMMIT_DETAILS_VIEW_MODE__ = ${safeJson(viewMode)};</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
