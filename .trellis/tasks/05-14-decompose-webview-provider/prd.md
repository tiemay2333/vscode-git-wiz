# brainstorm: 分解 GitGraphViewProvider 以减少协调开销

## Goal

通过将 `GitGraphViewProvider` 中的专用逻辑（如高亮验证、消息处理、文件监听）剥离到独立的深层模块（Deep Modules）中，减少其作为“超级协调者”的复杂性，提升代码的局部性（Locality）和维护性。

## What I already know

*   `GitGraphViewProvider` 承担了太多职责：Webview 生命周期管理、消息路由、Git 服务调用、UI 状态维护、异步高亮验证队列、文件系统监听。
*   `AsyncHighlightVerifier` 目前作为私有类定义在文件顶部，逻辑相对独立，适合剥离。
*   `handleMessage` 方法非常长，包含大量的条件判断，适合按功能拆分。

## Assumptions (temporary)

*   `GitGraphViewProvider` 应该只负责 VS Code Webview 的集成和顶层分发。
*   具体的业务操作（如执行 Git 命令、处理设置、管理文件操作）应由专门的处理器（Handlers）负责。
*   `AsyncHighlightVerifier` 应该是一个独立的、可测试的模块。

## Open Questions (Resolved)

*   **Preference**: 拆分消息处理器的方式。 -> **Decision**: 使用专门的 `CommandHandler` 辅助类，通过委派（Delegation）减少 Provider 的体积。
*   **Locality**: 状态管理。 -> **Decision**: 暂时保留在 Provider 中，但通过将逻辑（如 `applyHighlight`, `refresh`）拆分到更小的、职责单一的方法中来改善可读性。

## Requirements

*   [ ] **剥离异步验证器 (Deepen AsyncHighlightVerifier)**:
    *   创建 `src/git/AsyncHighlightVerifier.ts`，将验证队列逻辑移入。
    *   通过构造函数注入 `GitService` 和回调。
*   [ ] **消息路由瘦身 (Refactor handleMessage)**:
    *   在 `GitGraphViewProvider` 中提取 `GitCommandHandler`, `SettingsHandler`, `FileHandler` 等内部或外部模块。
    *   使 `handleMessage` 变成为清晰的分发层（Switchboard）。
*   [ ] **资源管理标准化**:
    *   确保所有剥离出的模块如果持有资源（如 Timer, Watcher），都实现了 `dispose()` 并在 Provider 销毁时正确释放。
*   [ ] **逻辑内聚**:
    *   将 `GitGraphViewProvider` 中纯 Git 逻辑的私有方法（如 `applyHighlight`, `loadMoreCommits`）进行审视，看是否能进一步简化。

## Acceptance Criteria (evolving)

*   [ ] `src/gitGraphView.ts` 的行数显著减少（目标减少 30% 以上）。
*   [ ] 各个处理器（Handlers）拥有明确的职责和简单的接口。
*   [ ] 功能表现与之前一致，无回归。

## Definition of Done (team quality bar)

*   Tests added/updated (for extracted logic where possible)
*   Lint / typecheck / CI green
*   Docs/notes updated if behavior changes

## Out of Scope (explicit)

*   不涉及 Webview 前端代码的重构。
*   不涉及 `GitService` 的进一步修改（已经在 Step 1 完成）。

## Technical Notes

*   文件：`src/gitGraphView.ts`, `src/git/AsyncHighlightVerifier.ts` (new)
*   模式：Delegation, Strategy Pattern
