# brainstorm: 集中化 Git 视图逻辑与状态管理

## Goal

修复项目中存在的架构设计缺陷：侧边栏视图与主面板视图之间的状态冲突、内存泄漏、并发 Git 操作冲突以及冗余的资源监听。通过将视图逻辑、状态管理和 Git 监听器从视图提供者（Provider）中解耦，实现全局统一的状态管理和服务调度。

## Requirements

*   **全局核心服务 (ViewDataManager)**：创建一个单例服务，负责持有全局唯一的 `GitService`、`GitWorkflowEngine` (实现全局锁) 和 `UnifiedGitWatcher`。
*   **独立 UI 状态**：侧边栏 (`WebviewView`) 和主面板 (`WebviewPanel`) 的 `GraphState` 保持独立。每个视图可以查看不同的分支、文件或搜索过滤结果。
*   **统一数据广播**：当 Git 仓库变动时，`ViewDataManager` 通知所有已注册的活动视图进行局部刷新。
*   **生命周期管理**：严格管理 `Disposable` 对象，修复配置监听器和文件监听器的内存泄漏问题。
*   **并发保护**：所有视图共享同一个操作锁，确保不会同时执行冲突的 Git 命令。

## Acceptance Criteria

*   [ ] [独立性] 同时开启侧边栏和主面板，在侧边栏切换分支，主面板视图内容保持不变。
*   [ ] [并发锁] 当侧边栏正在执行 Rebase 时，在主面板触发 Cherry-pick 应显示 "Another Git operation is in progress"。
*   [ ] [监听优化] 无论开启多少个视图，底层 `.git` 文件夹的 FSWatcher 仅存在一套。
*   [ ] [生命周期] 频繁开关视图后，VSCode 进程中不会累积配置变更监听器。
*   [ ] [回归测试] 现有的所有单元测试必须通过。

## Technical Approach

1.  **架构层次**：
    *   `src/views/ViewDataManager.ts` (New): 单例，持有 `GitService`, `GitWorkflowEngine`, `AsyncHighlightVerifier`, `GitWatcher`。维护活动视图列表。
    *   `src/views/gitGraphView.ts`: 变更为轻量级，仅负责处理视图生命周期、Webview 消息转发，并向 `ViewDataManager` 注册/注销自己。
2.  **状态分发**：
    *   `ViewDataManager` 提供 `refreshAll()` 接口。
    *   视图 Provider 接收来自 `ViewDataManager` 的更新信号，并使用自己的 `GraphState` 请求数据。

## Decision (ADR-lite)

**Context**: 侧边栏和主面板视图之间的逻辑耦合导致了状态覆盖、资源浪费和操作冲突。
**Decision**: 采用“全局核心服务 + 轻量级 Provider”架构。视图之间共享底层数据流和锁定机制，但保持 UI 过滤状态独立。
**Consequences**: 提高了代码的健壮性和扩展性，解决了并发冲突。由于状态独立，用户可以在不同视图间进行差异化操作，提升了多任务处理体验。

## Out of Scope

*   不涉及 Webview 内部（React）的渲染逻辑重构。
*   不涉及 Git 基础解析逻辑的修改。

## Technical Notes

*   关键文件：`src/views/gitGraphView.ts`, `src/git/workflow/engine.ts`, `src/core/graphState.ts`
*   需注意处理 `vscode.EventEmitter` 进行跨对象通信。

