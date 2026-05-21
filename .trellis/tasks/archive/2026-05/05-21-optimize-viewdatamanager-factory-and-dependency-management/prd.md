# Optimize ViewDataManager factory and dependency management

## Goal

优化 `ViewDataManager` 的工厂模式和依赖管理，解决当前单例缓存管理过于简单导致的资源清理风险，并实现更彻底的依赖倒置，提高代码的可测试性和可维护性。

## What I already know

* `ViewDataManager` 目前使用静态 `Map` (`_instances`) 缓存不同路径的实例。
* `ViewDataManager` 在构造函数中直接 `new` 了 `GitService`、`GitWorkflowEngine`、`AsyncHighlightVerifier` 等核心依赖。
* 资源清理主要依赖 `disposeManagerForPath` 手动触发。
* 多个模块（如 `GitGraphViewProvider`）直接通过 `ViewDataManager.getManagerForPath` 获取实例。

## Assumptions (temporary)

* 引入一个专门的 `DataManagerRegistry` 或 `RepositoryManager` 会比静态方法更易于管理生命周期。
* 使用依赖注入（DI）容器可能过于沉重，但构造函数注入（Constructor Injection）是必须的。
* 需要确保在工作区关闭或文件夹移除时，相关的 `ViewDataManager` 实例能被可靠地销毁。

## Open Questions

* 是否需要支持同一个路径下的多个 `ViewDataManager` 实例（目前看不需要）？
* 是否应该引入一个全局的 `ExtensionContext` 容器来管理所有的 Service？

## Requirements (evolving)

* **解耦依赖创建**：`ViewDataManager` 不再负责创建其核心依赖（`GitService`, `GitWorkflowEngine`, `AsyncHighlightVerifier`），改为通过构造函数接收。
* **引入 `DataManagerRegistry`**：替代原有的静态 `Map` 管理。负责：
    * 维护 `cwd` 到 `ViewDataManager` 的映射。
    * 响应工作区变化事件，自动清理资源。
    * 提供 `getActiveManager()` 等实用方法。
* **引入 `ViewDataManagerFactory`**：封装 `ViewDataManager` 及其复杂依赖链的创建逻辑。
    * 方便在测试中替换 `GitRunner` 或其他组件。
* **完善生命周期管理**：确保所有实例都能在插件停用或文件夹关闭时正确 `dispose`。
* **重构调用点**：
    * `extension.ts` 初始化 `Registry` 和 `Factory`。
    * `GitGraphViewProvider` 改为接收 `Registry` 引用，或在创建时由 `Registry` 注入 `DataManager`。

## Technical Approach

### 1. 组件职责划分

* **`DataManagerRegistry`**: 实例容器。生存周期与插件一致。
* **`ViewDataManagerFactory`**: 组装工厂。负责 `GitService -> WorkflowEngine -> Verifier -> ViewDataManager` 的依赖链组装。
* **`ViewDataManager`**: 领域对象。管理单个仓库的状态、监听器和 Service 聚合。

### 2. 重构步骤

1.  定义 `IDataManagerRegistry` 接口和实现。
2.  定义 `ViewDataManagerFactory`。
3.  重构 `ViewDataManager`：
    *   构造函数改为 `(cwd, gitService, workflowEngine, verifier)`。
    *   移除所有 `static` 方法。
4.  在 `extension.ts` 中组装：
    ```typescript
    const factory = new ViewDataManagerFactory();
    const registry = new DataManagerRegistry(factory);
    context.subscriptions.push(registry);
    ```
5.  更新 `GitGraphViewProvider`：
    *   构造函数接收 `registry`。
    *   `updateCwd` 时从 `registry` 获取实例。
6.  更新 `extension.ts` 中的命令调用。

## Acceptance Criteria (evolving)

* [ ] `ViewDataManager` 的构造函数参数化，移除 `new` 关键字创建核心依赖。
* [ ] 新增 `DataManagerRegistry` 类替代 `ViewDataManager` 的静态缓存。
* [ ] 编写测试用例验证 `Registry` 能正确创建和销毁实例。
* [ ] 所有 `ViewDataManager.getManagerForPath` 的调用点均已重构。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 重构 `GitService` 内部的逻辑（除非是为了配合 DI）。
* 替换 Webview 通信协议。

## Technical Notes

* 涉及文件：`src/views/ViewDataManager.ts`, `src/views/GitGraphViewProvider.ts`, `src/extension.ts`。
* 现有模式参考：`VSCodeUIService` 在 `ViewDataManager` 中被创建并传入 `GitWorkflowEngine`。
