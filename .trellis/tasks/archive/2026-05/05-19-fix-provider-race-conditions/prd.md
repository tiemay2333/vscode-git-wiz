# brainstorm: 修复 GitGraphViewProvider 中的竞态条件与状态不一致

## Goal

修复 `GitGraphViewProvider` 在处理 Webview 消息、Git 异步刷新以及缓存加载时存在的竞态条件。通过引入序列化队列、原子化缓存加载和取消令牌等机制，确保视图状态的准确性和系统的健壮性。

## What I already know

*   `GitGraphViewProvider` 存在刷新请求重叠导致的滚动重置状态覆盖问题。
*   `calculateUIStatus` 存在并发加载签名缓存的冗余开销和写冲突。
*   Webview 消息（如 `reverifyCommit`）没有与全局刷新同步，可能导致过时结果。
*   `ViewDataManager` 是单例，但 `GitGraphViewProvider` 内部仍维护了一些局部状态和缓存。

## Assumptions (temporary)

*   引入异步任务队列（Async Queue）可以有效序列化并发的 `refresh` 请求。
*   使用 Promise 锁（Mutex/Lock）可以解决签名缓存的原子加载问题。

## Open Questions

*   **队列实现**：是引入外部轻量级队列库，还是手动实现简单的 Promise 链式队列？
*   **取消策略**：对于过时的刷新请求，是等待其完成还是尝试通过 `CancellationToken` 中断 Git 操作？

## Requirements (evolving)

*   实现一个异步任务队列，确保 `refresh`、`loadMoreCommits` 等方法按顺序执行。
*   实现原子化的签名缓存加载逻辑。
*   在 `handleMessage` 中同步处理消息，避免在刷新期间执行冲突的异步任务。
*   确保 `updateViewTitle` 在各种边界情况下都能正确获取 `currentPanel`。

## Acceptance Criteria (evolving)

*   [ ] 并发触发多次刷新时，视图最终状态正确，滚动位置符合预期。
*   [ ] 签名缓存加载在并发请求下仅执行一次 Git 命令。
*   [ ] 切换分支时，旧分支的验证任务被正确丢弃或忽略。
*   [ ] Lint / Typecheck 通过。

## Definition of Done (team quality bar)

*   Tests added/updated (unit/integration where appropriate)
*   Lint / typecheck / CI green
*   Docs/notes updated if behavior changes
*   Rollout/rollback considered if risky

## Out of Scope (explicit)

*   重构整个 Webview 通信协议。
*   优化 GitLog 查询性能（除非与竞态条件直接相关）。

## Technical Approach

### 1. 极简异步队列 (Promise Queue)
在 `GitGraphViewProvider` 内部实现一个简单的异步队列成员。所有修改状态或发起 Git 操作的 Webview 消息处理都将通过此队列序列化。

### 2. 刷新合并逻辑 (Request Coalescing)
针对 `refresh` 请求：
*   如果当前正在执行刷新，则将新请求标记为 `_pendingRefresh`。
*   如果 `pending` 期间有多个请求包含 `resetScroll: true`，则最终执行的刷新必须携带 `resetScroll: true`（状态合并）。

### 3. 原子化签名加载 (Signature Lock)
使用 `signaturesLoadingPromise` 模式确保 `getBranchCommitSignatures` 在并发调用时仅触发一次 Git 查询。

## Decision (ADR-lite)

**Context**: 并发刷新请求导致滚动位置状态被覆盖，且签名加载存在冗余开销。
**Decision**: 采用“内部队列 + 请求合并”方案。
**Consequences**: 提高了视图在高频操作下的稳定性，减少了 Git 进程开销，但需要注意队列清理以防止内存增长。
