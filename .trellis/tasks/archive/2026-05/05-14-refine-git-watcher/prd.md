# brainstorm: 细化 Git 文件监听器以提升刷新性能

## Goal

通过缩小 Git 文件监听器的监控范围（从全量 `.git/**` 细化到核心状态文件），减少无效的 UI 刷新触发，提升大仓库下的响应性能。

## What I already know

*   当前 `src/gitGraphView.ts` 中的 `setupGitWatcher()` 监听了 `.git/**` 的所有变动。
*   这种全量监听会导致很多无关紧要的变动（如 git log cache, index 更新等）频繁触发 `refresh()`。
*   建议的优化方向是精准监听：`HEAD` (分支切换), `refs/heads/**` (本地分支), `refs/remotes/**` (远程分支), `index` (暂存区)。

## Assumptions (temporary)

*   仅监听上述核心文件足以覆盖 95% 以上的用户主动操作场景（提交、切换分支、拉取等）。
*   VS Code 的 `RelativePattern` 支持多个具体的监听路径。

## Open Questions (Resolved)

*   **Preference**: 是否需要同时监听 `.git/index`？ -> **No**. 仅显示提交图，不需要频繁触发刷新。
*   **Edge Case**: 是否需要监控变基中间过程？ -> **No**. 仅在变基完成后（HEAD 指向新位置）触发即可。

## Requirements

*   重构 `src/gitGraphView.ts` 中的 `setupGitWatcher()`。
*   监听以下精确路径：
    *   `.git/HEAD`
    *   `.git/refs/heads/**`
    *   `.git/refs/remotes/**`
    *   `.git/refs/tags/**`
*   移除对全量 `.git/**` 的监听。
*   保持现有的 500ms `debouncedRefresh` 机制。
*   确保在多个监听器之间共享防抖逻辑。

## Acceptance Criteria

*   [x] 切换分支时，UI 自动刷新。
*   [x] 进行新的 commit 时，UI 自动刷新。
*   [x] 执行 `git fetch` 导致远程分支更新时，UI 自动刷新。
*   [x] 增删标签时，UI 自动刷新。
*   [x] `git add` 或文件保存不应触发刷新。
*   [x] 减少大仓库下 `.git` 内部缓存文件变动导致的无效刷新。

## Definition of Done (team quality bar)

*   Tests added/updated (if applicable)
*   Lint / typecheck / CI green
*   Docs/notes updated if behavior changes

## Out of Scope (explicit)

*   改变 `refresh()` 内部的全量拉取逻辑（这属于后续性能优化任务）。
*   修改前端渲染性能。

## Technical Notes

*   文件路径：`src/gitGraphView.ts`
*   相关方法：`setupGitWatcher()`
*   参考文档：VS Code API - `FileSystemWatcher`
