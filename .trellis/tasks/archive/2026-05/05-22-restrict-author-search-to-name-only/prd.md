# Restrict author search to name only

## Goal

当用户在搜索框输入作者进行搜索时，仅匹配作者的“姓名”部分，忽略“邮箱”部分。确保单轨模式（后端过滤）与图形模式（客户端过滤）的行为保持一致。

## Requirements

*   **仅匹配姓名**：修改 `src/git/core/LogEngine.ts`，将 `--author` 的匹配范围限制在姓名部分。
*   **正则转义**：对用户输入的搜索词进行正则转义，防止特殊字符导致 Git 命令报错或非预期行为。
*   **模式一致性**：单轨模式和图形模式下的搜索逻辑应统一为“仅匹配姓名”。

## Decision (ADR-lite)

**Context**: Git 默认的 `--author` 会匹配 `Name <email>`，导致输入数字等通用字符时会搜出大量仅邮箱匹配的提交。
**Decision**: 采用正则表达式限制匹配仅在 `<` 之前发生，并对用户输入进行转义。
**Consequences**: 搜索将更加精确，符合用户对“作者”搜索的直观预期；邮箱将不再作为搜索维度（除非未来明确增加该功能）。

## Acceptance Criteria

*   [ ] 在单轨模式下搜索 `1`，仅当姓名包含 `1` 时显示提交。
*   [ ] 在图形模式下搜索 `1`，仅当姓名包含 `1` 时高亮显示。
*   [ ] 搜索包含正则字符（如 `+`, `(`, `[`）的作者名时，系统不会崩溃且能正确匹配。

## Technical Approach

1.  **正则构造**：使用 `^.*<input>.*<` 形式的正则，或者更简单的 `input.*<`。
2.  **转义函数**：实现一个简单的正则转义函数处理用户输入。
3.  **代码修改**：
    *   `src/git/core/LogEngine.ts`: 修改 `getGitLog` 中的 `--author` 参数构造。
    *   `src/webview/graph/GraphView.tsx`: (如果需要) 检查客户端过滤逻辑是否已严格限制为姓名。

## Out of Scope

*   增加搜索邮箱的开关。
*   修改 UI 布局。

## Technical Notes

*   修改文件：`src/git/core/LogEngine.ts`
*   Git 命令行参考：`git log --author="pattern.*<" --extended-regexp` 或者简单的正则匹配。

