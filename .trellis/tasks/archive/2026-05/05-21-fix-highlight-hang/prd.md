# prd: fix-highlight-hang

## Goal

修复高亮功能中 cherry-pick 候选提交一直处于“pending”（转圈）状态的问题。

## What I already know

*   当高亮显示当前分支功能开启时，`UIConverter` 会根据签名（作者邮箱+主题）匹配 cherry-pick 提交。
*   签名匹配成功的提交被标记为 `pending` 状态。
*   `webview` 中的 `CommitRow` 组件在 `verificationStatus === 'pending'` 时会显示加载动画（转圈）。
*   代码中存在 `AsyncHighlightVerifier` 类，负责异步执行 Patch-ID 深度验证（Tier 3/4）。
*   **关键缺陷**：代码中没有任何地方调用 `AsyncHighlightVerifier.queueVerification`，导致 `pending` 状态永远无法推进。
*   `CoreHandler` 中的 `reverifyCommit` 只是简单地刷新了整个视图，没有执行针对性的验证。

## Requirements

1.  当 `ViewDataManager` 获取到提交列表并通过 `UIConverter` 计算 UI 状态时，如果发现有 `pending` 状态的提交，应自动将其及其对应的候选目标加入 `AsyncHighlightVerifier` 的队列进行异步验证。
2.  `UIConverter` 需要返回 `pending` 提交与其候选目标的映射，以便 `ViewDataManager` 调用 `verifier`。
3.  确保 `AsyncHighlightVerifier` 的验证结果（verified/failed）能通过已有的事件机制回传给 Webview。

## Acceptance Criteria

*   [ ] 模拟一个 cherry-pick 提交（签名相同但哈希不同），查看其在 UI 中是否先显示转圈，然后转为高亮（verified）或正常（failed）。
*   [ ] 验证 `AsyncHighlightVerifier` 的并发限制和生成（generation）重置逻辑依然有效，不会在快速滚动或刷新时导致过时更新。

## Out of Scope

*   改进 `patch-id` 算法本身的效率。
*   添加其他高亮层级（如 Tier 5 模糊匹配）。
