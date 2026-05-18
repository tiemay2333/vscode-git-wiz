# Git Workflow Engine 架构改进

## 目标
通过创建一个深层（Deep）的 `GitWorkflowEngine` 模块，消除 `extension.ts`、`GitCommandHandler.ts` 和 `GitGraphView.ts` 之间的逻辑重复，提高代码的**局部性（Locality）**和**复用性（Leverage）**。

## 我已经知道的信息
*   目前的 Git 工作流（如删除分支、Cherry-pick、Squash）逻辑分散在多个 shallow 模块中。
*   UI 交互（进度条、警告框、通知）与 Git 逻辑紧密耦合。
*   `GitService` 提供原子操作，但高级工作流逻辑（组合多个操作、处理特定错误、UI 确认）未被封装。

## 假设
*   我们将引入一个 `UIService` 接口作为 Seam，以解耦引擎与 VSCode 具体 UI 的依赖。
*   引擎将采用“基于任务”或“基于类”的模式来管理不同的工作流（如 `DeleteBranchWorkflow`）。

## 需求 (演进中)
*   [ ] 实现 `UIService` 接口及 VSCode 实现（包含进度显示、警告框、通知）。
*   [ ] 实现 `GitWorkflowEngine` 核心框架：
    *   采用 **Workflow 对象模式**：每个操作为一个类，支持多步骤交互和扩展。
    *   引入 **并发锁机制**：防止同一 Git 操作被并发触发。
    *   **统一文案管理**：确保不同入口触发的 UI 提示保持一致。
*   [ ] 迁移“删除分支”工作流（包含：合并状态检查、远程分支关联处理、强制删除 Fallback）。
*   [ ] 迁移“Cherry-pick”工作流（包含：多提交选择处理、冲突错误检测、成功通知）。
*   [ ] 将 `extension.ts` 和 `GitCommandHandler.ts` 切换为调用新引擎。

## 验收标准 (演进中)
*   [ ] `extension.ts` 和 `GitCommandHandler.ts` 中的重复逻辑被移除。
*   [ ] 所有迁移的工作流均能通过 `UIService` 模拟器进行自动化测试验证。
*   [ ] VSCode 侧边栏和 Webview 的操作行为保持一致。

## 技术方案
### 核心组件
1.  **`UIService` (Interface)**: 定义 `confirm`, `showProgress`, `notify` 等抽象方法。
2.  **`VSCodeUIService` (Adapter)**: 实现 `UIService`，调用 `vscode.window` 相关 API。
3.  **`BaseWorkflow<T>` (Abstract Class)**: 所有工作流的基类，定义执行逻辑和状态管理。
4.  **`GitWorkflowEngine`**: 负责调度工作流、管理并发锁和注入依赖。

### 目录结构
*   `src/git/workflow/` - 存放引擎核心代码。
*   `src/git/workflow/uiservice.ts` - 接口定义。
*   `src/git/workflow/vscode-ui.ts` - VSCode 实现。
*   `src/git/workflow/engine.ts` - 调度引擎。
*   `src/git/workflow/impl/` - 具体工作流类（如 `DeleteBranchWorkflow.ts`）。

## 决策记录 (ADR-lite)
**Context**: Git 操作逻辑在 Extension 和 Webview 之间高度重复，且 UI 交互逻辑难以测试。
**Decision**: 引入 UI 集成的深度工作流引擎，通过 `UIService` 解耦。
**Consequences**: 提高了逻辑复用性，允许通过 Mock UIService 对 Git 交互逻辑进行单元测试。

## 排除范围 (Out of Scope)
*   首批迁移以外的 Git 操作（如 Rebase, Merge 等）。
*   重构前端 Webview 的 UI 渲染逻辑。

