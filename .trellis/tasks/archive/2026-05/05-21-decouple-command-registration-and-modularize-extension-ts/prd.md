# Decouple command registration and modularize extension.ts

## Goal

拆分目前约 470 多行的 `src/extension.ts` 文件。将众多的 VSCode 命令注册逻辑按领域（分支操作、提交操作、设置操作等）提取到专门的模块中，使 `activate` 函数保持简洁，专注于顶层组件的装配。

## What I already know

* `src/extension.ts` 包含了大量的 `vscode.commands.registerCommand` 调用。
* 许多命令逻辑实际上只是调用了 `GitGraphViewProvider` 或 `ViewDataManager` 的方法。
* 已有的 Handler 类（`GitCommandHandler` 等）现在位于 `src/views/handlers/`。

## Assumptions (temporary)

* 引入一个 `CommandManager` 或 `CommandRegistry` 来统一处理命令的注册和分发。
* 命令逻辑可以按功能划分为：`GeneralCommands`、`GitCommands`、`SettingsCommands` 等。
* 拆分后的代码应更容易维护，且 `extension.ts` 的行数应显著减少（目标 100 行以内）。

## Open Questions

* 是否应该将所有命令实现都移入 Handler 类？
* 某些命令（如 `switchRepository`）依赖于多个 Service，如何优雅地注入依赖？

## Requirements (evolving)

* **模块化命令注册**：将命令按功能分组并提取到独立文件。
* **精简 `activate` 函数**：使其只负责初始化 `Registry`、`Factory`、`Provider` 和 `CommandManager`。
* **统一依赖注入**：确保命令模块能方便地访问到 `DataManagerRegistry` 和 `GitGraphViewProvider`。

## Acceptance Criteria (evolving)

* [ ] `src/extension.ts` 行数显著减少（目标 < 150 行）。
* [ ] 新增 `src/commands/` 目录（或 `src/views/commands/`），包含分类后的命令模块。
* [ ] 所有功能点（命令）在重构后依然正常工作。
* [ ] `pnpm tsc` 检查通过。

## Definition of Done

* 代码拆分合理，职责清晰。
* 单元测试（如果有必要）或手动验证确保命令路径正确。
* Lint / typecheck / CI green。

## Out of Scope (explicit)

* 改变命令的行为逻辑。
* 重构 Webview 前端代码。

## Technical Notes

* 涉及文件：`src/extension.ts`。
* 可以参考 VSCode 官方推荐的命令组织模式。
