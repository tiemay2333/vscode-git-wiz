import { describe, expect, it } from "vitest";
import { makeMsgEditorScript, makeSeqEditorScript } from "@/git/utils/rebaseScripts";

describe("makeMsgEditorScript", () => {
    it("writes the message to process.argv[2]", () => {
        const script = makeMsgEditorScript("Hello world");
        expect(script).toContain(`"Hello world\\n"`);
        expect(script).toContain("process.argv[2]");
        expect(script).toContain("fs.writeFileSync");
    });

    it("handles special characters in message", () => {
        const msg = "It's done! (feat: add auth)";
        const script = makeMsgEditorScript(msg);
        expect(script).toContain(JSON.stringify(`${msg}\n`));
    });
});

describe("makeSeqEditorScript", () => {
    it("generates script with overrides serialized", () => {
        const overrides = [{ hash: "abc123", action: "reword" }];
        const script = makeSeqEditorScript(overrides);
        expect(script).toContain("reword");
        expect(script).toContain("abc123");
        expect(script).toContain("overrides");
        expect(script).toContain("fs.readFileSync");
        expect(script).toContain("fs.writeFileSync");
    });

    it("serializes multiple overrides", () => {
        const overrides = [
            { hash: "abc", action: "reword" },
            { hash: "def", action: "squash" },
        ];
        const script = makeSeqEditorScript(overrides);
        expect(script).toContain("abc");
        expect(script).toContain("def");
        expect(script).toContain("reword");
        expect(script).toContain("squash");
        // Verify JSON serialization matches
        expect(script).toContain(JSON.stringify(overrides));
    });

    it("matches hash prefix both ways", () => {
        const script = makeSeqEditorScript([{ hash: "abc123", action: "edit" }]);
        // The generated JS should check both directions of prefix match
        expect(script).toContain("o.hash.startsWith(parts[1]) || parts[1].startsWith(o.hash)");
    });
});
