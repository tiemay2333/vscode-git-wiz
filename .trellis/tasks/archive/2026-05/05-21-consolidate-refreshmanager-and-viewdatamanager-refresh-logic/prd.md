# Consolidate RefreshManager and ViewDataManager refresh logic

## Goal

整合 `RefreshManager` 和 `ViewDataManager` 的刷新逻辑。目前两者都实现了某种形式的“请求合并”和“状态管理”，导致逻辑冗余且难以追踪。目标是将刷新流控逻辑统一，并明确各组件在刷新链路中的职责。

## What I already know

* `ViewDataManager` 负责监听文件系统变化，并实现了基于 `.git/index.lock` 的锁定机制和 500ms 的防抖（debounce）。
* `RefreshManager` 负责视图层的刷新流控，确保不会在正在刷新时发起新的请求，并支持请求合并。
* 刷新链路目前是：文件变化 -> `ViewDataManager` (防抖+锁) -> `Provider` -> `RefreshManager` (状态机) -> 实际执行刷新。

## Assumptions (temporary)

* 刷新流控（防抖、锁、合并）最好集中在数据层（`ViewDataManager`），因为数据层最清楚什么时候“适合”刷新。
* 视图层（`RefreshManager`）仍然需要保留，但它应该更专注于 Webview 的“就绪状态”和“刷新互斥”，而不是防抖。
* `ViewDataManager` 的 `refreshAll` 可以升级为支持 `Promise` 的刷新机制，或者提供更丰富的刷新状态。

## Open Questions

* 是否应该将 `RefreshManager` 的逻辑直接移入 `ViewDataManager`？还是保留 `RefreshManager` 但让它只负责视图特定的控制？
* 500ms 的防抖是否应该移到更靠近“触发源”的地方，或者由 `RefreshManager` 统一处理？

## Requirements (evolving)

* **职责明确**：
    * **`ViewDataManager` (Data Layer)**：负责 Git 锁管理（`.git/index.lock`）、数据变更防抖（Debounce）和请求合并（如 `resetScroll` 状态合并）。它通过 `onDidRefresh` 事件通知外部“现在可以刷新了”。
    * **`RefreshManager` (View Layer)**：负责 Webview 的就绪检查（`ready` 消息）和刷新互斥（避免 Webview 并发消息导致的 UI 错乱）。
* **消除冗余**：
    * 移除 `RefreshManager` 中的防抖逻辑（如果有的话，目前 `RefreshManager` 主要是状态机，防抖在 `ViewDataManager`）。
    * 统一锁定和挂起逻辑。如果 Git 被锁定，`ViewDataManager` 应该静默等待解锁后再触发刷新。
* **参数透传**：
    * `refreshAll` 支持 `options: { resetScroll?: boolean }`。
    * `onDidRefresh` 携带相同参数。
* **状态可见性**：
    * 提供清晰的刷新状态，方便 UI 显示加载动画。

## Technical Approach

### 1. 刷新链路重构

**触发源（FS Watcher / 手动 / 配置变更）**
    ↓
**`ViewDataManager.refreshAll({ resetScroll })`**
    * 合并 `resetScroll` 标记。
    * 检查 `index.lock`。若锁定，设置 `_pendingRefresh = true`。
    * 500ms 防抖。
    ↓ (fire `onDidRefresh({ resetScroll })`)
**`GitGraphViewProvider.refresh({ resetScroll })`**
    ↓
**`RefreshManager.refresh({ resetScroll })`**
    * 检查 Webview 是否 `initialized` (ready)。
    * 检查是否正在执行刷新 (`_refreshing`)。
    * 最终调用 `_doRefresh`。

### 2. 重构步骤

1.  修改 `IViewDataManager` 接口，支持带参数的 `refreshAll` 和 `onDidRefresh`。
2.  重构 `ViewDataManager` 实现：
    *   改进锁检查和防抖逻辑，支持状态合并。
3.  优化 `RefreshManager`：
    *   移除不必要的逻辑，保持其作为“视图关口”的纯粹性。
4.  更新 `GitGraphViewProvider`：
    *   适配新的事件接口和调用流程。

## Acceptance Criteria (evolving)

* [ ] `ViewDataManager.refreshAll` 能够正确处理连续触发。
* [ ] `RefreshManager` 简化，不再负责复杂的防抖，而是专注于视图执行互斥。
* [ ] `.git/index.lock` 逻辑与刷新流控完美结合，不再散落在各处。
* [ ] 所有刷新操作（手动、自动、配置变更）路径统一。

## Technical Notes

* 涉及文件：`src/views/ViewDataManager.ts`, `src/views/RefreshManager.ts`, `src/views/GitGraphViewProvider.ts`。
