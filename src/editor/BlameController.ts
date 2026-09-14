import type { BlameLine, BlameResult } from "@/git/core/BlameService";
import type { GitGraphViewProvider } from "@/views/GitGraphViewProvider";
import * as vscode from "vscode";
import { BlameService } from "@/git/core/BlameService";
import { ChildProcessGitRunner } from "@/git/core/GitRunner";
import { t } from "@/locale/i18n";

export class BlameController implements vscode.Disposable {
    private readonly service = new BlameService(new ChildProcessGitRunner());
    private readonly hintsChanged = new vscode.EventEmitter<void>();
    private currentHint?: { document: vscode.TextDocument; version: number; result: BlameResult; blame: BlameLine };

    private readonly wholeFile = vscode.window.createTextEditorDecorationType({
        before: {
            color: new vscode.ThemeColor("editorCodeLens.foreground"),
            margin: "0 12px 0 0",
            // Attachment options lack padding and whitespace controls.
            textDecoration: "none; padding: 0 6px; white-space: pre; box-sizing: content-box",
        },
    });

    private readonly fullFiles = new Set<string>();
    private readonly disposables: vscode.Disposable[] = [this.hintsChanged, this.wholeFile];
    private cache?: { document: vscode.TextDocument; version: number; result: BlameResult | undefined };
    private timer?: ReturnType<typeof setTimeout>;
    private generation = 0;
    private watchedCwd?: string;
    private gitWatchers: vscode.Disposable[] = [];

    constructor(private readonly graph: GitGraphViewProvider) {
        this.disposables.push(
            vscode.languages.registerInlayHintsProvider({ scheme: "file" }, {
                onDidChangeInlayHints: this.hintsChanged.event,
                provideInlayHints: (document, range) => {
                    const current = this.currentHint;
                    if (!current || current.document !== document)
                        return [];
                    // Keep the previous hint visible while an edit is being
                    // re-blamed; the completed result replaces it atomically.
                    const line = Math.min(current.blame.line, Math.max(0, document.lineCount - 1));
                    const position = document.lineAt(line).range.end;
                    if (!range.contains(position))
                        return [];
                    const label = new vscode.InlayHintLabelPart(this.inlineLabel(current.blame));
                    label.tooltip = this.hover(current.result, current.blame);
                    const spacing = new vscode.InlayHintLabelPart("\u00A0".repeat(6));
                    const hint = new vscode.InlayHint(position, [spacing, label]);
                    hint.paddingLeft = false;
                    return [hint];
                },
            }),
            vscode.window.onDidChangeActiveTextEditor(() => this.schedule(true)),
            vscode.window.onDidChangeTextEditorSelection((e) => {
                if (e.textEditor === vscode.window.activeTextEditor)
                    this.schedule();
            }),
            vscode.workspace.onDidChangeTextDocument((e) => {
                if (e.document === vscode.window.activeTextEditor?.document)
                    this.schedule(true, true);
            }),
            vscode.workspace.onDidSaveTextDocument(() => this.schedule(true, true)),
            vscode.workspace.onDidCloseTextDocument((document) => {
                this.fullFiles.delete(document.uri.toString());
                if (this.cache?.document === document)
                    this.cache = undefined;
            }),
            vscode.window.onDidChangeWindowState((e) => {
                if (e.focused)
                    this.schedule(true, true);
            }),
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration("git-wiz.currentLineBlame"))
                    this.schedule();
            }),
            vscode.commands.registerCommand("git-wiz.toggleFileBlame", async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor || editor.document.uri.scheme !== "file")
                    return;
                const key = editor.document.uri.toString();
                if (this.fullFiles.has(key))
                    this.fullFiles.delete(key);
                else
                    this.fullFiles.add(key);
                this.cache = undefined;
                this.clearInline();
                clearTimeout(this.timer);
                await this.update(++this.generation, true);
            }),
            vscode.commands.registerCommand("git-wiz.revealBlameCommit", async (cwd: string, hash: string) => {
                if (typeof cwd !== "string" || typeof hash !== "string" || !/^[\da-f]{40,64}$/.test(hash) || /^0+$/.test(hash))
                    return;
                await this.graph.revealCommit(cwd, hash);
            }),
        );
        this.schedule();
    }

    private schedule(invalidate = false, preserveInline = false) {
        if (invalidate)
            this.cache = undefined;
        clearTimeout(this.timer);
        const generation = ++this.generation;
        // Keep the current-line hint during edit/save refreshes; selection and
        // editor changes still clear it immediately and request a new line.
        if (!preserveInline)
            this.clearInline();
        for (const editor of vscode.window.visibleTextEditors) {
            // Keep full-file annotations visible while the debounced blame query
            // runs. The completed result replaces them atomically in update().
            if (!this.fullFiles.has(editor.document.uri.toString()))
                editor.setDecorations(this.wholeFile, []);
        }
        this.timer = setTimeout(() => void this.update(generation), 150);
    }

    private clearInline() {
        this.currentHint = undefined;
        this.hintsChanged.fire();
    }

    private inlineLabel(blame: BlameLine): string {
        const text = /^0+$/.test(blame.hash)
            ? t(vscode.env.language, "blameUncommitted")
            : `${blame.author} · ${this.annotationDate(blame)} · ${blame.summary}`;
        const characters = Array.from(text);
        return characters.length > 80 ? `${characters.slice(0, 79).join("")}…` : text;
    }

    private hover(result: BlameResult, blame: BlameLine): vscode.MarkdownString {
        const hover = new vscode.MarkdownString("", true);
        if (/^0+$/.test(blame.hash)) {
            hover.appendMarkdown("$(edit) ");
            hover.appendText(t(vscode.env.language, "blameUncommitted"));
        }
        else {
            hover.appendMarkdown("$(account) ");
            hover.appendText(blame.author);
            hover.appendMarkdown("\n\n$(mail) ");
            hover.appendText(blame.email);
            hover.appendMarkdown("\n\n$(history) ");
            hover.appendText(blame.date);
            hover.appendMarkdown("\n\n---\n\n$(git-commit) ");
            hover.appendText(blame.hash);
            hover.appendMarkdown("\n\n---\n\n$(note) ");
            hover.appendText(blame.message);
            const args = encodeURIComponent(JSON.stringify([result.cwd, blame.hash]));
            hover.appendMarkdown(`\n\n[$(git-branch) ${t(vscode.env.language, "blameReveal")}](command:git-wiz.revealBlameCommit?${args})`);
            hover.isTrusted = { enabledCommands: ["git-wiz.revealBlameCommit"] };
        }
        return hover;
    }

    private fileLabel(blame: BlameLine): { author: string; date: string } {
        return /^0+$/.test(blame.hash)
            ? { author: t(vscode.env.language, "blameUncommitted"), date: "" }
            : { author: blame.author, date: this.annotationDate(blame) };
    }

    private annotationDate(blame: BlameLine): string {
        return blame.dateOnly || blame.date.split(/\s+/)[0];
    }

    private columns(text: string): number {
        return Array.from(text).reduce((width, character) => {
            if (/\p{Mark}/u.test(character))
                return width;
            return width + (/[\u1100-\u115F\u2329\u232A\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6\p{Extended_Pictographic}]/u.test(character) ? 2 : 1);
        }, 0);
    }

    private async update(generation: number, reportErrors = false) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== "file")
            return;
        const document = editor.document;
        const full = this.fullFiles.has(document.uri.toString());
        const enabled = vscode.workspace.getConfiguration("git-wiz", document.uri).get("currentLineBlame", true);
        if (!full)
            editor.setDecorations(this.wholeFile, []);
        if (!full && !enabled)
            return;
        const version = document.version;
        try {
            const result = this.cache?.document === document && this.cache.version === version
                ? this.cache.result
                : await this.service.getBlame(document.uri.fsPath, document.getText());
            if (generation !== this.generation || document.version !== version || editor !== vscode.window.activeTextEditor)
                return;
            this.cache = { document, version, result };
            if (!result) {
                if (reportErrors)
                    vscode.window.showInformationMessage(t(vscode.env.language, "blameNoRepository"));
                return;
            }
            this.watchRepository(result);
            const lines = result.lines.filter(line => line.line < document.lineCount && (full || line.line === editor.selection.active.line));
            if (full) {
                const width = lines.reduce((max, blame) => {
                    const { author, date } = this.fileLabel(blame);
                    return Math.max(max, this.columns(author) + 6 + this.columns(date));
                }, 0);
                editor.setDecorations(this.wholeFile, lines.map((blame) => {
                    const { author, date } = this.fileLabel(blame);
                    const gap = " ".repeat(width - this.columns(author) - this.columns(date));
                    const position = document.lineAt(blame.line).range.start;
                    return {
                        range: new vscode.Range(position, position),
                        hoverMessage: this.hover(result, blame),
                        renderOptions: { before: { contentText: `${author}${gap}${date}`, width: `${width}ch` } },
                    };
                }));
            }
            else if (lines[0]) {
                this.currentHint = { document, version, result, blame: lines[0] };
                this.hintsChanged.fire();
            }
        }
        catch (error) {
            if (generation === this.generation && reportErrors)
                vscode.window.showErrorMessage(`Git Wiz: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private watchRepository(result: BlameResult) {
        if (this.watchedCwd === result.cwd)
            return;
        this.gitWatchers.forEach(watcher => watcher.dispose());
        this.gitWatchers = [];
        this.watchedCwd = result.cwd;
        for (const directory of result.gitDirs) {
            const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(
                vscode.Uri.file(directory),
                "{HEAD,index,packed-refs,refs/heads/**,refs/remotes/**}",
            ));
            this.gitWatchers.push(watcher, watcher.onDidChange(() => this.schedule(true, true)), watcher.onDidCreate(() => this.schedule(true, true)), watcher.onDidDelete(() => this.schedule(true, true)));
        }
    }

    dispose() {
        ++this.generation;
        clearTimeout(this.timer);
        this.clearInline();
        for (const editor of vscode.window.visibleTextEditors) {
            editor.setDecorations(this.wholeFile, []);
        }
        this.disposables.forEach(disposable => disposable.dispose());
        this.gitWatchers.forEach(watcher => watcher.dispose());
    }
}
