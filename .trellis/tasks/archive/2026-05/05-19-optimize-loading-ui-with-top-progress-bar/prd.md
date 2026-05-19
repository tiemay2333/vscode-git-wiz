# optimize-loading-ui-with-top-progress-bar

## Goal

将现有的 VS Code 底部导航栏加载（Status Bar Progress）替换为插件页面顶部的快速划线滑动加载样式。

## Requirements

*   **无限滚动样式**：进度条采用无限循环的滑动动画（Indeterminate），不显示具体百分比。
*   **触发范围限制**：仅针对显式的 Git 操作（如 Fetch, Pull, Push, Cherry-pick 等通过 `UIService.showProgress` 调用的操作），普通的列表刷新不显示。
*   **全局覆盖**：进度条固定在整个 Webview 容器的最顶部，跨越左侧分支面板和右侧图表区域。
*   **非阻塞**：进度条显示期间，UI 应保持可交互（除非操作本身需要锁定）。

## Acceptance Criteria

*   [ ] 执行 Git 操作时，Webview 顶部出现蓝色（或 VS Code 主题色）的滑动进度条。
*   [ ] 操作完成后，进度条立即消失。
*   [ ] 进度条高度约为 2-3px，位置精准对齐容器顶部。
*   [ ] 移除原有的底部状态栏进度提示。

## Technical Approach

1.  **Webview 端**：
    *   在 `src/webview/shared/ProgressBar.tsx` 创建进度条组件，使用 CSS 动画实现。
    *   在 `src/webview/index.tsx` 的 `App` 组件中添加状态监听。
2.  **扩展端**：
    *   在 `GitGraphViewProvider` 中添加 `setLoading(visible: boolean)` 方法，通过 `postMessage` 发送指令。
    *   修改 `VSCodeUIService.showProgress`，在任务开始前发送显示消息，结束后发送隐藏消息，并移除 `vscode.window.withProgress`。

## Definition of Done

*   Git 操作期间顶部进度条可见。
*   底部状态栏不再显示相关进度。
*   代码经过类型检查。

## Out of Scope

*   普通刷新操作的进度显示。
*   多任务并行的多个进度条叠加（目前系统假设单任务执行）。
