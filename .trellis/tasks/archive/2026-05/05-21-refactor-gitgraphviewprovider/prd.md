# GitGraphViewProvider 职责拆分与解耦

## Goal

重构 `GitGraphViewProvider` 类，将其沉重的职责（上帝对象）拆分为更小、更专注的组件。目标是提高代码的可维护性、可测试性，并减少并发刷新时的竞态条件。

## What I already know

* `GitGraphViewProvider` 目前管理：
    * Webview 生命周期（resolveWebviewView, dispose）
    * 复杂的刷新状态控制（`_refreshing`, `_pendingRefresh` 等）
    * 缓存（`_branchSignaturesCache`）
    * UI 状态计算（`calculateUIStatus`, `updateViewTitle`）
    * Webview 消息分发（`handleMessage`）
    * 命令处理器、设置处理器和 UI 状态处理器的初始化与注入
* 项目已有一些辅助处理器：`GitCommandHandler`, `SettingsHandler`, `UIStateHandler`, `FileHandler`。
* `ViewDataManager` 负责管理每个路径的 Git 实例。

## Assumptions (temporary)

* 我们可以引入一个 `WebviewMessenger` 来处理所有与 Webview 的原始通信。
* 我们可以引入一个 `RefreshCoordinator`（或类似的状态机）来管理刷新逻辑。
* 我们可以将 UI 状态计算（如 `uiStatus`）移动到专门的转换层或 `GitCommit` 扩展方法中。

## Decision (ADR-lite)

**Context**: 现有的刷新逻辑依赖多个 boolean 标志位，难以维护且容易产生竞态。
**Decision**: 采用“状态机 + 请求合并”方案（方案 2）。引入 `RefreshManager`，当刷新正在进行时，新的请求将被合并，仅在当前刷新结束后执行最后一次最新请求。
**Consequences**: 简化了 Provider 的内部逻辑，提高了刷新的可靠性和性能，减少了不必要的 Git 调用。

## Requirements (evolving)

1. **职责拆分**：将 `GitGraphViewProvider` 拆分为以下部分：
    * `GitGraphViewProvider`: 仅负责 VS Code WebviewViewProvider 接口对接和生命周期。
    * `WebviewMessenger`: 负责 `handleMessage` 和 `postToWebview`。
    * `RefreshManager`: 负责协调刷新逻辑，采用状态机合并重复请求。
    * `UIConverter`: 负责将 Git 领域对象转换为 Webview 所需的 UI 状态。
2. **解耦初始化**：处理器（Handlers）的初始化逻辑应更加清晰。
3. **消除竞态**：重构后的刷新逻辑应天然支持请求合并和取消，避免使用大量的 boolean 标志位。

## Acceptance Criteria (evolving)

* [ ] `GitGraphViewProvider.ts` 的行数显著减少。
* [ ] 所有现有功能（刷新、搜索、命令执行、高亮、设置）保持正常。
* [ ] 刷新逻辑不再依赖于分散的私有标志位。
* [ ] 新引入的组件具有清晰的接口和职责。

## Definition of Done (team quality bar)

* 测试通过（Vitest）
* Lint / typecheck 绿色
* 不引入破坏性行为变更

## Out of Scope (explicit)

* 重构 Webview 前端代码。
* 大规模修改 `GitService` 内部实现（除非接口需要调整）。

## Technical Notes

* 相关文件：
    * `src/views/GitGraphViewProvider.ts`
    * `src/views/ViewDataManager.ts`
    * `src/core/graphState.ts`
    * `src/views/webviewContent.ts`
* 规范参考：`.trellis/spec/frontend/`
