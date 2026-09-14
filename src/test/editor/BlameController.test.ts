import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlameController } from "@/editor/BlameController";

const mocks = vi.hoisted(() => ({
    enabled: true,
    commands: new Map<string, (...args: any[]) => any>(),
    events: new Map<string, (...args: any[]) => void>(),
    getBlame: vi.fn(),
    editor: undefined as any,
    decorations: [] as any[],
    providers: {} as any,
    openedHover: undefined as any,
    hideHover: vi.fn(),
}));
vi.mock("@/git/core/BlameService", () => ({ BlameService: class { getBlame = mocks.getBlame; } }));
vi.mock("vscode", () => {
    const event = (name: string) => (callback: (...args: any[]) => void) => {
        mocks.events.set(name, callback);
        return { dispose: vi.fn() };
    };
    return {
        languages: {
            registerInlayHintsProvider: (_selector: unknown, provider: unknown) => {
                mocks.providers.inlay = provider;
                return { dispose: vi.fn() };
            },
            registerHoverProvider: (_selector: unknown, provider: unknown) => {
                mocks.providers.hover = provider;
                return { dispose: vi.fn() };
            },
        },
        EventEmitter: class {
            event = vi.fn();
            fire = vi.fn();
            dispose = vi.fn();
        },
        InlayHintLabelPart: class {
            constructor(public value: string) {}
        },
        InlayHint: class {
            constructor(public position: unknown, public label: unknown) {}
        },
        Hover: class {
            constructor(public contents: unknown) {}
        },
        window: {
            get activeTextEditor() { return mocks.editor; },
            get visibleTextEditors() { return [mocks.editor]; },
            createTextEditorDecorationType: (options: unknown) => {
                const decoration = { options, dispose: vi.fn() };
                mocks.decorations.push(decoration);
                return decoration;
            },
            onDidChangeActiveTextEditor: event("editor"),
            onDidChangeTextEditorSelection: event("selection"),
            onDidChangeWindowState: event("focus"),
            showInformationMessage: vi.fn(),
            showErrorMessage: vi.fn(),
        },
        workspace: {
            getConfiguration: () => ({ get: () => mocks.enabled }),
            createFileSystemWatcher: () => ({
                onDidChange: event("git"),
                onDidCreate: event("gitCreate"),
                onDidDelete: event("gitDelete"),
                dispose: vi.fn(),
            }),
            onDidChangeTextDocument: event("edit"),
            onDidSaveTextDocument: event("save"),
            onDidCloseTextDocument: event("close"),
            onDidChangeConfiguration: event("config"),
        },
        commands: { executeCommand: async (name: string) => {
            if (name === "editor.action.hideHover")
                await mocks.hideHover();
            if (name === "editor.action.showHover")
                mocks.openedHover = mocks.providers.hover.provideHover(mocks.editor.document, mocks.editor.selection.active);
        }, registerCommand: (name: string, fn: (...args: any[]) => any) => {
            mocks.commands.set(name, fn);
            return { dispose: vi.fn() };
        } },
        Uri: { file: (path: string) => path },
        RelativePattern: class { },
        ThemeColor: class { },
        Range: class { },
        MarkdownString: class {
            value = "";
            constructor(_value: string, public supportThemeIcons: boolean) {}
            appendText(text: string) { this.value += text; }
            appendMarkdown(text: string) { this.value += text; }
        },
        env: { language: "en" },
    };
});

const result = { cwd: "/repo", gitDirs: ["/repo/.git"], lines: [0, 1].map(line => ({ line, hash: "a".repeat(40), author: "Author", email: "author@example.com", date: "2026-01-01", commitTime: "2026-01-01T12:34:56.000Z", summary: "Message", message: "Message\n\nFull commit body" })) };
function createEditor(file = "/repo/file") {
    return {
        document: { uri: { scheme: "file", fsPath: file, toString: () => file }, version: 1, lineCount: 2, getText: () => "a\nb", lineAt: (line: number) => ({ range: { start: { line, character: 0 }, end: { line, character: 1 } } }) },
        selection: { active: { line: 0 } },
        setDecorations: vi.fn(),
    };
}

function hints() {
    return mocks.providers.inlay.provideInlayHints(mocks.editor.document, { contains: () => true });
}

describe("blameController", () => {
    let controller: BlameController;
    const revealCommit = vi.fn();
    beforeEach(() => {
        vi.useFakeTimers();
        mocks.enabled = true;
        mocks.openedHover = undefined;
        mocks.hideHover.mockReset().mockResolvedValue(undefined);
        mocks.decorations = [];
        mocks.editor = createEditor();
        mocks.getBlame.mockReset().mockResolvedValue(result);
        controller = new BlameController({ revealCommit } as any);
    });
    afterEach(() => {
        controller.dispose();
        vi.useRealTimers();
    });

    it("shows current line by default and clears it when the setting is disabled", async () => {
        await vi.runAllTimersAsync();
        expect(hints()[0].label[0].value).toBe("Author · 2026-01-01 · Message");
        expect(hints()[0].tooltip).toBeUndefined();
        expect(hints()[0].label[0].tooltip).toBeUndefined();
        expect(mocks.providers.hover.provideHover(mocks.editor.document, { line: 0 })).toBeUndefined();
        mocks.enabled = false;
        mocks.events.get("config")!({ affectsConfiguration: () => true });
        await vi.runAllTimersAsync();
        expect(hints()).toEqual([]);
        expect(mocks.editor.setDecorations).toHaveBeenLastCalledWith(mocks.decorations[0], []);
    });

    it("toggles all lines independently of the current-line setting and uses restricted commit links", async () => {
        mocks.enabled = false;
        await mocks.commands.get("git-wiz.toggleFileBlame")!();
        const [type, annotations] = mocks.editor.setDecorations.mock.calls.at(-1)!;
        expect(type).toBe(mocks.decorations[0]);
        expect(annotations).toHaveLength(2);
        expect(annotations[0].renderOptions.before.contentText).toBe(`Author${" ".repeat(8)}2026-01-01`);
        expect(annotations[0].renderOptions.before.width).toBe("24ch");
        expect(mocks.decorations[0].options.before.border).toBeUndefined();
        expect(mocks.decorations[0].options.before.textDecoration).not.toContain("border");
        expect(annotations[0].hoverMessage.isTrusted).toEqual({ enabledCommands: ["git-wiz.revealBlameCommit"] });
        await mocks.commands.get("git-wiz.revealBlameCommit")!("/repo", "a".repeat(40));
        expect(revealCommit).toHaveBeenCalledWith("/repo", "a".repeat(40));
        await mocks.commands.get("git-wiz.toggleFileBlame")!();
        expect(hints()).toEqual([]);
        expect(mocks.editor.setDecorations).toHaveBeenLastCalledWith(mocks.decorations[0], []);
    });

    it("truncates long inline blame while preserving the full ordered hover", async () => {
        const summary = "长".repeat(120);
        const message = `${summary}\n\nDetailed commit body`;
        mocks.getBlame.mockResolvedValue({ ...result, lines: [{ ...result.lines[0], summary, message }] });
        await vi.runAllTimersAsync();
        const part = hints()[0].label[0];
        expect(Array.from(part.value)).toHaveLength(80);
        expect(part.value).toMatch(/…$/);
        expect(mocks.providers.hover.provideHover(mocks.editor.document, { line: 0 })).toBeUndefined();
        // A click may move the cursor before VS Code dispatches the inlay command.
        mocks.events.get("selection")!({ textEditor: mocks.editor });
        mocks.hideHover.mockImplementationOnce(() => vi.advanceTimersByTimeAsync(150));
        await mocks.commands.get(part.command.command)!(...part.command.arguments);
        expect(mocks.openedHover.contents.supportThemeIcons).toBe(true);
        expect(mocks.openedHover.contents.value).toContain(
            `$(account) Author\n\n$(mail) author@example.com\n\n$(history) 2026-01-01\n\n---\n\n$(git-commit) ${"a".repeat(40)}\n\n---\n\n$(note) ${message}`,
        );
        expect(mocks.providers.hover.provideHover(mocks.editor.document, { line: 0 })).toBeUndefined();
    });

    it("aligns different author names and dates in equal-width columns", async () => {
        mocks.getBlame.mockResolvedValue({ ...result, lines: [
            { ...result.lines[0], author: "Longer Author" },
            { ...result.lines[1], author: "张三" },
        ] });
        await mocks.commands.get("git-wiz.toggleFileBlame")!();
        const annotations = mocks.editor.setDecorations.mock.calls.at(-1)![1];
        expect(annotations[0].renderOptions.before).toEqual({ contentText: `Longer Author${" ".repeat(8)}2026-01-01`, width: "31ch" });
        expect(annotations[1].renderOptions.before).toEqual({ contentText: `张三${" ".repeat(17)}2026-01-01`, width: "31ch" });
    });

    it("rejects stale inlay commands after edits", async () => {
        await vi.runAllTimersAsync();
        const command = hints()[0].label[0].command;
        mocks.editor.document.version++;
        mocks.events.get("edit")!({ document: mocks.editor.document });
        await mocks.commands.get(command.command)!(...command.arguments);
        expect(mocks.openedHover).toBeUndefined();
        expect(mocks.providers.hover.provideHover(mocks.editor.document, { line: 0 })).toBeUndefined();
    });

    it("discards old results after the document changes", async () => {
        let resolve!: (value: typeof result) => void;
        mocks.getBlame.mockReturnValueOnce(new Promise((done) => {
            resolve = done;
        }));
        await vi.advanceTimersByTimeAsync(150);
        const oldEditor = mocks.editor;
        mocks.editor = createEditor("/repo/other");
        mocks.events.get("editor")!();
        oldEditor.setDecorations.mockClear();
        resolve(result);
        await vi.runAllTimersAsync();
        expect(oldEditor.setDecorations).not.toHaveBeenCalled();
    });
});
