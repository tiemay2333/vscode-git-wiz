# brainstorm: Optimize Workflow UI and Add I18n

## Goal

优化 `GitWorkflowEngine` 的用户界面体验和国际化支持。具体包括：将所有进度/通知状态移至 VSCode 状态栏（底部导航栏），并为所有用户可见的字符串添加多语言（中/英）支持。

## What I already know

*   `GitWorkflowEngine` 目前在 `VSCodeUIService.showProgress` 中使用 `vscode.ProgressLocation.Notification`（弹窗显示）。
*   用户要求将其改为在底部状态栏显示（对应 `vscode.ProgressLocation.Window`）。
*   项目前端已有 i18n 实现（`src/webview/settings/i18n.ts`），支持 zh/en。
*   后端（Extension 侧）目前主要使用硬编码的中文字符串（在 `DeleteBranchWorkflow` 和 `CherryPickWorkflow` 中）。

## Assumptions (temporary)

*   后端可以复用前端的 `t(locale, key)` 逻辑，但需要维护自己的一套词典。
*   `vscode.env.language` 可以作为后端 i18n 的 locale 来源。

## Open Questions

*   **词典维护方式**：汇总到全局文件 `src/i18n.ts`，由前端和后端共享。
*   **变量支持**：`t` 函数需要支持模板变量替换（例如 `t(locale, "deleteConfirm", { name: "main" })`）。

## Requirements (evolving)

*   [ ] 将 `src/webview/settings/i18n.ts` 迁移至 `src/i18n.ts` 成为全局词典。
*   [ ] 升级 `t` 函数，支持通过对象传入变量并替换字符串中的占位符（如 `{name}`）。
*   [ ] 修改 `VSCodeUIService.showProgress`，将 `location` 改为 `vscode.ProgressLocation.Window`。
*   [ ] 提取 `DeleteBranchWorkflow`、`CherryPickWorkflow` 及 `GitWorkflowEngine` 中的所有硬编码字符串到全局 `src/i18n.ts`。
*   [ ] 更新前端所有引用 `i18n.ts` 的路径。

## Acceptance Criteria (evolving)

*   [ ] 当执行删除分支或 Cherry-pick 时，进度显示在 VSCode 底部状态栏。
*   [ ] 所有的通知（通知/警告/错误）和对话框文案均根据 VSCode 当前语言显示（中文或英文）。
*   [ ] 单元测试通过，且能够通过 Mock UIService 验证翻译键的正确性。

## Technical Notes

*   `vscode.ProgressLocation.Window` 模式下，进度显示更轻量，不会遮挡编辑器。
*   `vscode.env.language` 返回当前安装的语言包标识。
