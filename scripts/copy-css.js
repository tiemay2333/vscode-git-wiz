#!/usr/bin/env node
/**
 * Cross-platform CSS asset copy script.
 * Copies .css files from src/webview/ to out/webview/ during build.
 * Uses fs.cpSync (Node 16.7+) — works on Windows, macOS, and Linux.
 */
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const srcDir = path.join(rootDir, "src", "webview");
const outDir = path.join(rootDir, "out", "webview");

// Copy app CSS files
for (const subdir of ["graph", "commitDetails"]) {
    const srcFile = path.join(srcDir, subdir, `${subdir}.css`);
    const destDir = path.join(outDir, subdir);
    const destFile = path.join(destDir, `${subdir}.css`);

    if (!fs.existsSync(srcFile)) {
        console.warn(`SKIP: ${srcFile} not found`);
        continue;
    }

    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcFile, destFile);
    console.log(`COPY: ${srcFile} → ${destFile}`);
}

// Copy codicon assets (strip query string from font URL for webview compat)
const codiconSrcDir = path.join(rootDir, "node_modules", "@vscode/codicons", "dist");
const codiconDestDir = path.join(outDir, "codicons");

if (fs.existsSync(codiconSrcDir)) {
    fs.mkdirSync(codiconDestDir, { recursive: true });
    for (const file of ["codicon.css", "codicon.ttf"]) {
        const src = path.join(codiconSrcDir, file);
        const dest = path.join(codiconDestDir, file);
        if (fs.existsSync(src)) {
            if (file === "codicon.css") {
                let css = fs.readFileSync(src, "utf-8");
                css = css.replace(/url\("\.\/codicon\.ttf\?[^"]*"\)/g, "url(\"./codicon.ttf\")");
                fs.writeFileSync(dest, css, "utf-8");
                console.log(`COPY+STRIP: ${src} → ${dest}`);
            }
            else {
                fs.copyFileSync(src, dest);
                console.log(`COPY: ${src} → ${dest}`);
            }
        }
    }
}
