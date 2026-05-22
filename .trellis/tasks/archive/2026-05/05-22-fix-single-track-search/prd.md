# Fix search filter bug in single track mode

## Goal

修复单轨模式（single track mode）下搜索过滤失效的问题。由于 `GitGraphViewProvider` 在初始化 `UIStateHandler` 时未正确映射 `searchFilters` 状态到 `ViewDataManager`，导致后端过滤逻辑未被触发。

## What I already know

*   `GraphView.tsx` 在单轨模式下会发送 `search` 命令到插件后端。
*   `UIStateHandler.ts` 接收到 `search` 命令后会尝试设置 `this._state.searchFilters`。
*   `GitGraphViewProvider.ts` 中传给 `UIStateHandler` 的 state 对象是通过 `as any` 强制转换的字面量，且缺失了 `searchFilters` 的 getter/setter。
*   `ViewDataManager.ts` 已经实现了 `setSearchFilters` 方法，能够触发带过滤条件的刷新。

## Requirements

*   在 `GitGraphViewProvider.ts` 中，完善传给 `UIStateHandler` 的 state 对象，增加 `searchFilters` 的属性映射。
*   `set searchFilters` 应该调用 `this._dataManager.setSearchFilters(filters)`。
*   `get searchFilters` 应该返回当前快照中的搜索过滤条件。

## Acceptance Criteria

*   [ ] 在单轨模式下，输入搜索关键字并回车，右侧提交列表应正确过滤。
*   [ ] 清除搜索关键字后，右侧提交列表应恢复显示所有记录。

## Definition of Done (team quality bar)

*   Lint / typecheck / CI green
*   手动验证搜索功能在单轨模式和图形模式下的行为符合预期。

## Out of Scope (explicit)

*   不涉及搜索 UI 的样式调整。
*   不涉及图形模式（graph mode）下的客户端搜索逻辑（该部分目前工作正常）。

## Technical Notes

*   修改位置：`src/views/GitGraphViewProvider.ts` 中的 `_initHandlers` 方法。
