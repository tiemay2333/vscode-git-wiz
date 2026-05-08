import antfu from "@antfu/eslint-config";

export default antfu({
    type: "lib",
    typescript: true, // 启用 TypeScript 支持
    stylistic: {
        indent: 4, // 缩进使用 4 个空格
        semi: true, // 使用分号
        quotes: "double", // or 'single'
    },
    rules: {
        "ts/explicit-function-return-type": "off", // 关闭函数必须显式返回类型的规则
    },
    ignores: [
        "out",
        "node_modules",
        "**/*.d.ts",
        ".vscode",
        ".husky",
        "**/*.md",
    ],
});
