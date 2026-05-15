import type { GitCommit } from "./gitParser";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

const CSS_DIR = path.resolve(__dirname, "webview");

function readCSS(subdir: string): string {
    try {
        return fs.readFileSync(path.join(CSS_DIR, subdir, `${subdir}.css`), "utf-8");
    }
    catch {
        return "";
    }
}

// CSS loaded from files (copied to out/webview/ during build)
const graphCSS = readCSS("graph");
const commitDetailsCSS = readCSS("commitDetails");

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
    return JSON.stringify(value).replace(/<\//g, "<\\/");
}

function getNonce(): string {
    let text = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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
    filesViewMode: "list" | "tree" = "list",
    filterFile: string | null = null,
    highlightCurrentBranch: boolean = false,
    showTags: boolean = true,
    showRemoteBranches: boolean = true,
    showGraph: boolean = true,
    searchDefaultMode: string = "single",
    locale: string = "en",
): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "out", "webview", "index.js"));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="${locale}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
    <title>Tree</title>
    <style>${graphCSS}</style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">window.__VIEW__ = 'graph'; window.__COMMITS__ = ${safeJson(commits)}; window.__BRANCHES__ = ${safeJson(branches)}; window.__HAS_MORE__ = ${hasMore}; window.__FILTER_BRANCH__ = ${safeJson(filterBranch)}; window.__CURRENT_BRANCH__ = ${safeJson(currentBranch)}; window.__FILES_VIEW_MODE__ = ${safeJson(filesViewMode)}; window.__FILTER_FILE__ = ${safeJson(filterFile)}; window.__HIGHLIGHT_CURRENT_BRANCH__ = ${highlightCurrentBranch}; window.__SHOW_TAGS__ = ${showTags}; window.__SHOW_REMOTE_BRANCHES__ = ${showRemoteBranches}; window.__SHOW_GRAPH__ = ${showGraph}; window.__SEARCH_DEFAULT_MODE__ = ${safeJson(searchDefaultMode)}; window.__LOCALE__ = ${safeJson(locale)};</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

export function getCommitDetailsHtml(
    webview: vscode.Webview,
    data: CommitDetailsData,
    extensionUri: vscode.Uri,
    viewMode: "list" | "tree" = "list",
    locale: string = "en",
): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "out", "webview", "index.js"));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
<title>Commit ${data.fullHash.substring(0, 7)}</title>
<style>${commitDetailsCSS}</style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">window.__VIEW__ = 'commitDetails'; window.__COMMIT_DETAILS__ = ${safeJson(data)}; window.__COMMIT_DETAILS_VIEW_MODE__ = ${safeJson(viewMode)}; window.__LOCALE__ = ${safeJson(locale)};</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
