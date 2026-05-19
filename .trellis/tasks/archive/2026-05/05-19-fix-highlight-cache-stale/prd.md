# brainstorm: 优化 AsyncHighlightVerifier 缓存管理以防止数据陈旧

## Goal

在 Git 仓库状态发生变化（触发 `refreshAll`）时，确保 `AsyncHighlightVerifier` 的内部缓存（Patch ID 缓存）能够及时重置。这可以防止在分支切换、Rebase 或提交变更后，高亮逻辑由于引用旧的 Patch ID 而导致显示错误。

## What I already know

*   `ViewDataManager` 维护着 `AsyncHighlightVerifier` 的单例实例 `_verifier`。
*   `ViewDataManager.refreshAll()` 是所有视图刷新的入口点，通常由文件系统监听器（.git/HEAD 等）触发。
*   `AsyncHighlightVerifier` 内部有 `_patchIdCache` 和 `_filePatchIdCache`，目前仅在 `dispose` 时清理。
*   目前的 `refreshAll` 仅触发 `_onDidRefresh` 事件，没有清理验证器的缓存。

## Assumptions (temporary)

*   在 `refreshAll` 触发时重置缓存是安全的，因为刷新意味着视图将重新加载，旧的 Patch ID 不再可靠。

## Open Questions

*   无阻塞性问题。

## Requirements (evolving)

*   修改 `ViewDataManager.refreshAll`：在防抖计时器启动之前**立即**调用 `this._verifier.reset()`。这可以确保在 Git 仓库发生变动时，任何待处理的高亮验证请求被立即取消，且旧缓存被清空。
*   保持 `GitGraphViewProvider` 内部的 `_branchSignaturesCache` 逻辑不变（不需要在 `ViewDataManager` 中清理）。

## Acceptance Criteria (evolving)

*   [ ] `ViewDataManager.refreshAll` 能够立即调用 `this._verifier.reset()`。
*   [ ] 当 `refreshAll` 被连续触发时，`reset()` 也会被连续调用（确保始终清理）。
*   [ ] 切换分支或执行 git 操作后，高亮验证器能够正确重新计算。
*   [ ] 单元测试验证缓存重置逻辑。

## Definition of Done (team quality bar)

*   Tests added/updated (unit/integration where appropriate)
*   Lint / typecheck / CI green
*   Docs/notes updated if behavior changes
*   Rollout/rollback considered if risky

## Out of Scope (explicit)

*   实现 LRU 缓存（本任务仅关注刷新时的重置）。
*   重构 `GitGraphViewProvider` 的缓存逻辑。

## Technical Notes

*   文件：`src/views/ViewDataManager.ts`, `src/git/highlight/AsyncHighlightVerifier.ts`
*   关联：`GitGraphViewProvider.ts` 中的 `_branchSignaturesCache` 也是一个相关的缓存点。
