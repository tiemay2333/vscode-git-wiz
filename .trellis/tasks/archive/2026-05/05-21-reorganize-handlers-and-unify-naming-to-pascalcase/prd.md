# Reorganize handlers and unify naming to PascalCase

## Goal

将散落在 `src/core/` 和 `src/commands/` 中用于处理 Webview 消息的 Handler 类统一移动到 `src/views/handlers/` 目录下，并将文件名统一重命名为 PascalCase（大写开头），以清晰界定组件职责并统一命名规范。

## What I already know

* 待移动的文件包括：
    * `src/core/uiStateHandler.ts` -> `src/views/handlers/UIStateHandler.ts`
    * `src/core/settingsHandler.ts` -> `src/views/handlers/SettingsHandler.ts`
    * `src/core/fileHandler.ts` -> `src/views/handlers/FileHandler.ts`
    * `src/commands/gitCommandHandler.ts` -> `src/views/handlers/GitCommandHandler.ts`
* 引用这些 Handler 的主要文件有：
    * `src/views/GitGraphViewProvider.ts`
    * `src/extension.ts`
* 项目已配置 `@/` 别名指向 `src/`。

## Assumptions (temporary)

* 移动文件后，需要批量更新 import 路径。
* 目前没有其他的外部模块依赖这些 Handler（除了 Provider 和 Extension）。

## Open Questions

* 是否需要为这些 Handler 建立一个统一的导出文件（`index.ts`）？

## Requirements (evolving)

* **目录重构**：新建 `src/views/handlers/`。
* **命名统一**：所有 Handler 文件名改为 PascalCase。
* **路径修复**：更新所有相关的 import 语句，优先使用 `@/` 别名。
* **类型安全**：确保重构后 `tsc` 类型检查通过。

## Acceptance Criteria (evolving)

* [ ] `src/core/` 中不再包含任何以 `Handler` 结尾的文件。
* [ ] `src/commands/` 目录暂时清空（或移除，取决于是否有其他文件）。
* [ ] 所有引用点均已更新并能正常工作。
* [ ] `pnpm tsc` 检查无报错。

## Definition of Done

* Tests added/updated (if applicable)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes

## Out of Scope (explicit)

* 合并 `WebviewMessenger`（留待第二阶段）。
* 拆分 `extension.ts`（留待第三阶段）。

## Technical Notes

* 使用 `git mv` 或手动 `mv` 进行操作，确保 Git 历史能尽可能保留。
* 更新 import 时注意处理相对路径和别名路径。
