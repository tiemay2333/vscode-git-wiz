import antfu from "@antfu/eslint-config";

export default antfu({
    type: "lib",
    typescript: true, // 启用 TypeScript 支持
    stylistic: {
        indent: 4, // 缩进使用 4 个空格
        semi: true, // 使用分号
        quotes: "double", // or 'single'
    },
    ignores: [
        "dist",
        "node_modules",
        "**/*.d.ts",
        ".vscode",
        ".husky",
        "**/*.md",
    ],
});
