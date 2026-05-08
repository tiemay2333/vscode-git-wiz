import { describe, expect, it } from "vitest";
import { getFileTree } from "../webview/shared/fileTree";

describe("getFileTree", () => {
    it("returns empty array for empty input", () => {
        expect(getFileTree([])).toEqual([]);
    });

    it("creates single leaf node for a flat file", () => {
        const result = getFileTree([{ path: "file.txt" }]);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ name: "file.txt", path: "file.txt", isDirectory: false });
    });

    it("creates directory node for nested file", () => {
        const result = getFileTree([{ path: "dir/file.txt" }]);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ name: "dir", path: "dir", isDirectory: true });
        const dirChildNodes = Object.values(result[0].children);
        expect(dirChildNodes).toHaveLength(1);
        expect(dirChildNodes[0]).toMatchObject({ name: "file.txt", path: "dir/file.txt", isDirectory: false });
    });

    it("creates deeply nested structure", () => {
        const result = getFileTree([{ path: "a/b/c/file.txt" }]);
        const aChildren = Object.values(result[0].children);
        expect(result[0].name).toBe("a");
        expect(aChildren[0].name).toBe("b");
        const bChildren = Object.values(aChildren[0].children);
        expect(bChildren[0].name).toBe("c");
        const cChildren = Object.values(bChildren[0].children);
        expect(cChildren[0].name).toBe("file.txt");
        expect(cChildren[0].isDirectory).toBe(false);
    });

    it("groups files in the same directory", () => {
        const result = getFileTree([
            { path: "src/index.ts" },
            { path: "src/utils.ts" },
        ]);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("src");
        expect(Object.values(result[0].children)).toHaveLength(2);
    });

    it("sorts directories before files", () => {
        const result = getFileTree([
            { path: "b/file.ts" },
            { path: "a" },
        ]);
        expect(result[0].name).toBe("b");
        expect(result[0].isDirectory).toBe(true);
        expect(result[1].name).toBe("a");
        expect(result[1].isDirectory).toBe(false);
    });

    it("sorts alphabetically within same level", () => {
        const result = getFileTree([
            { path: "z.ts" },
            { path: "a.ts" },
            { path: "m.ts" },
        ]);
        expect(result.map(n => n.name)).toEqual(["a.ts", "m.ts", "z.ts"]);
    });

    it("passes through status and stats to leaf nodes", () => {
        const result = getFileTree([
            { path: "style.css", status: "M", insertions: 10, deletions: 2 },
        ]);
        expect(result[0]).toMatchObject({
            path: "style.css",
            status: "M",
            insertions: 10,
            deletions: 2,
            isDirectory: false,
        });
    });

    it("handles mixed depth files", () => {
        const result = getFileTree([
            { path: "readme.md" },
            { path: "src/index.ts" },
            { path: "src/lib/helper.ts" },
        ]);
        expect(result).toHaveLength(2);
        const readmeNode = result.find(n => n.name === "readme.md")!;
        expect(readmeNode.isDirectory).toBe(false);
        const srcNode = result.find(n => n.name === "src")!;
        expect(srcNode.isDirectory).toBe(true);
        const srcChildren = Object.values(srcNode.children);
        expect(srcChildren).toHaveLength(2);
        const libNode = srcChildren.find(n => n.name === "lib")!;
        expect(libNode.isDirectory).toBe(true);
        expect(Object.values(libNode.children)).toHaveLength(1);
        expect(Object.values(libNode.children)[0].name).toBe("helper.ts");
    });
});
