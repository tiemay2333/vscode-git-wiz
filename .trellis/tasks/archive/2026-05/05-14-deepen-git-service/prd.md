# brainstorm: 重构 GitOperations 为深层 GitService 并强化 GitRunner Seam

## Goal

将 `GitOperations` 重构为高杠杆（Deep）的 `GitService`，通过强化 `GitRunner` Seam 实现逻辑与执行的彻底分离，并移除对 VS Code UI 的直接依赖，提升代码的测试性与局部性（Locality）。

## What I already know

*   `GitOperations` 目前混合了业务逻辑、Git 命令拼接（`cp.exec`）和 VS Code UI 交互（`showInformationMessage`, `withProgress`）。
*   `GitRunner` 接口存在但未被充分利用，大多数命令仍直接使用 `cp.exec`。
*   逻辑散落在 `extension.ts` 和 `GitOperations.ts` 中，存在不一致性。

## Assumptions (temporary)

*   `GitService` 应该是纯逻辑层，不应感知 VS Code 的窗口或进度条。
*   所有的 Git 执行都应通过 `GitRunner` 完成。
*   UI 交互应由调用方（`GitGraphViewProvider` 或 `extension.ts`）处理。

## Open Questions (Resolved)

*   **Preference**: 错误处理机制。 -> **Decision**: `GitService` 将抛出异常，由调用方负责捕获并使用 `vscode.window.showErrorMessage` 展示。这样可以保持 Service 的纯度。
*   **Locality**: 是否应将 `extension.ts` 中的所有 Git 逻辑收口？ -> **Decision**: **Yes**. `extension.ts` 应仅作为入口配置和 UI 桥接层。

## Requirements

*   [ ] **重塑 GitRunner Seam**:
    *   将 `GitOperations.ts` 中所有的 `cp.exec` 替换为 `this.runner.exec(args[])`。
    *   确保命令参数正确转义，避免 Shell 注入。
*   [ ] **解耦 UI 依赖**:
    *   移除 `GitOperations.ts` 对 `vscode` 窗口（`showInformationMessage`, `showErrorMessage`, `showWarningMessage`, `showQuickPick`, `showInputBox`）的所有直接调用。
    *   移除对 `vscode.window.withProgress` 的调用。
    *   将 UI 交互逻辑上移至 `GitGraphViewProvider` 或 `extension.ts`。
*   [ ] **统一 Git 逻辑 (Locality)**:
    *   将 `extension.ts` 中关于 `createBranch`, `deleteBranch`, `fetch`, `pull`, `push`, `deleteTag` 等命令的实现移动到 `GitService` 中。
*   [ ] **重命名与接口定义**:
    *   将 `GitOperations` 类重命名为 `GitService`（反映其作为 Deep Module 的职责）。
*   [ ] **质量保障**:
    *   编写单元测试，使用 Mock 的 `GitRunner` 验证 `GitService` 拼接的参数是否正确，以及是否正确处理了 Git 的退出码。

## Acceptance Criteria (evolving)

*   [ ] `GitOperations.ts` 中不再包含 `import * as vscode from "vscode"`（除了可能的类型定义）。
*   [ ] 单元测试覆盖核心 Git 逻辑且不依赖真实的 Git 环境。
*   [ ] 原有的 Git 功能（cherry-pick, revert, branch operations 等）在 UI 层依然工作正常（由调用方处理 UI）。

## Definition of Done (team quality bar)

*   Tests added/updated (Unit tests for GitService)
*   Lint / typecheck / CI green
*   Docs/notes updated if behavior changes

## Out of Scope (explicit)

*   不涉及 Webview 内部的逻辑。
*   不涉及 `gitParser.ts` 的解析逻辑（已经是 Deep Module）。

## Technical Notes

*   文件：`src/gitOperations.ts`, `src/git/GitRunner.ts`, `src/extension.ts`, `src/gitGraphView.ts`
*   模式：Adapter Pattern (GitRunner), Service Layer (GitService)
