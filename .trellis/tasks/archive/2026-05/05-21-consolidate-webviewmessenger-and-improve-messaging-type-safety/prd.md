# Consolidate WebviewMessenger and improve messaging type safety

## Goal

优化插件与 Webview 之间的通信机制。目前 `WebviewMessenger` 职责过于单一（浅层模块），且消息定义（`WebviewMessage`）属于“大杂烩”模式，缺乏严格的类型约束。目标是通过重构 `WebviewMessenger`，建立一套类型安全的通信协议，降低维护成本并减少运行时错误。

## What I already know

* `src/views/WebviewMessenger.ts` 是一个简单的包装类，仅负责 `postMessage`。
* `WebviewMessage` 接口在 `GitGraphViewProvider.ts` 中定义，包含了所有可能的字段（大多可选）。
* 消息发送散落在 `GitGraphViewProvider` 的各个方法中。

## Assumptions (temporary)

* 使用 TypeScript 的判别联合类型（Discriminated Unions）或泛型可以大幅提升消息定义的安全性。
* `WebviewMessenger` 应该演进为一个**深层模块**，对外提供类型友好的发送接口，对内处理 VSCode Webview 的底层通信细节。
* 需要同时考虑“从插件到 Webview”和“从 Webview 到插件”的双向通信规范。

## Open Questions

* 是否应该引入一个标准的 Command 定义模式，让每一个 `command` 对应一个特定的 `Payload` 类型？
* 是否需要将 Webview 端（前端）的通信逻辑也进行同步重构以匹配新的类型定义？

## Requirements (evolving)

* **定义强类型协议**：为所有 Webview 消息建立严格的类型映射。
* **深化 Messenger 接口**：
    * 提供 `post<T extends Command>(command: T, data: Payload<T>)` 风格的方法。
    * 封装 Webview 状态检查（是否可见、是否已销毁）。
* **重构消息路由**：优化 `handleMessage` 中的逻辑，利用类型保护（Type Guards）减少显式的类型转换。

## Acceptance Criteria (evolving)

* [ ] 建立独立的 `src/views/types/WebviewProtocol.ts` 定义通信协议。
* [ ] `WebviewMessenger` 支持基于协议的类型检查，不再接受任意 payload。
* [ ] 移除 `GitGraphViewProvider` 中冗余的消息字段手动组装。
* [ ] `pnpm tsc` 验证全量类型通过。

## Definition of Done

* 类型安全：所有 `postMessage` 调用均受编译器保护。
* 代码简洁：减少了 `GitGraphViewProvider` 中的通信模板代码。
* 单元测试：为新的协议解析逻辑添加测试（如果逻辑足够复杂）。

## Out of Scope (explicit)

* 完全重写前端消息处理逻辑（仅做必要的适配）。
* 引入 Socket.io 或其他重量级通信库。

## Technical Approach

### 1. 通信协议设计 (WebviewProtocol)

我们将引入两套判别联合类型（Discriminated Unions）：

*   **`FromWebviewMessage`**: 定义 Webview 发往插件的所有消息。
    *   例如：`{ command: 'cherryPick', commitHash: string }`, `{ command: 'settingsUpdateSetting', key: string, value: any }`。
*   **`ToWebviewMessage`**: 定义插件发往 Webview 的所有消息。
    *   例如：`{ command: 'replaceCommits', commits: GitCommit[], ... }`, `{ command: 'setLoading', visible: boolean }`。

### 2. 深化 `WebviewMessenger`

`WebviewMessenger` 将不再接受 `any` 类型的消息：
```typescript
public postMessage(message: ToWebviewMessage): void {
    // 对内封装逻辑，对外强类型约束
}
```

### 3. 重构步骤

1.  **定义协议**：在 `src/views/types/WebviewProtocol.ts` 中根据现有代码梳理并定义所有消息类型。
2.  **升级 Messenger**：修改 `WebviewMessenger.ts`，引入类型约束。
3.  **适配 Handler**：
    *   修改 `src/views/handlers/` 下的所有 Handler，使其 `handle` 方法接收特定类型的消息，利用 TypeScript 的 `switch` 自动收窄类型。
4.  **适配 Provider**：
    *   更新 `GitGraphViewProvider.ts` 中的 `handleMessage` 方法，将 `WebviewMessage` 替换为 `FromWebviewMessage`。
    *   利用新定义的类型简化消息发送处的代码（无需再手动组装 `command` 字符串）。
5.  **前端适配**：
    *   在 Webview 端同步引用（或镜像）该协议，确保双端一致。

