# Refactor Message Dispatch Mechanism

## Goal

Clean up the redundant and lengthy message routing logic in `GitGraphViewProvider.ts`. Currently, `handleMessage` uses complex `if` conditions to route messages to various handlers (`GitCommandHandler`, `SettingsHandler`, `FileHandler`, `UIStateHandler`). We want a unified registry-based or observer-based dispatch mechanism to improve **Locality** and **AI-navigability**.

## What I already know

*   `GitGraphViewProvider.ts` has a `handleMessage` method that manually routes dozens of commands.
*   Handlers already exist (`GitCommandHandler`, `SettingsHandler`, etc.), but the routing logic is still inside the Provider.
*   The `FromWebviewMessage` type defines all possible commands coming from the Webview.
*   We use a `_messageQueue` to serialize async operations.

## Assumptions (temporary)

*   A unified `MessageDispatcher` or a similar pattern can reduce the Provider's size.
*   Handlers can register themselves for specific message commands.

## Open Questions

*   Should we use a single dispatcher or let each handler subscribe to the message event?
*   How do we maintain the `_messageQueue` serialization in a decoupled way?

## Decision (ADR-lite)

**Context**: `GitGraphViewProvider.ts` has a bloated `handleMessage` method with complex manual routing.
**Decision**: Implement a **Command Registry** based message dispatch mechanism. A central `MessageDispatcher` will maintain a mapping of `command -> Handler`.
**Consequences**: Individual handlers will register their supported commands. The Provider will simply delegate to the dispatcher. This improves **Locality** and makes it easier to add new webview features.

## Requirements (evolving)

* [ ] **Define `IMessageHandler`**: An interface that handlers must implement, including a list of supported commands.
* [ ] **Implement `MessageDispatcher`**:
    *   Manages handler registration.
    *   Handles message lookup and execution.
    *   **Encapsulates `_messageQueue`**: Ensures all async operations are serialized within the dispatcher.
* [ ] **Refactor Handlers**:
    *   Update `GitCommandHandler`, `SettingsHandler`, `FileHandler`, and `UIStateHandler` to implement `IMessageHandler`.
* [ ] **Simplify Provider**: Reduce `GitGraphViewProvider.handleMessage` to a single call to the dispatcher.
* [ ] **Type Safety**: Ensure the `message` object is correctly typed when passed to handlers.

## Acceptance Criteria (evolving)

* [ ] `GitGraphViewProvider.ts` size is reduced by removing the large `if/else` block.
* [ ] All 30+ webview commands (cherry-pick, checkout, settings, etc.) work as before.
* [ ] Dispatcher correctly sequences async operations.

## Definition of Done (team quality bar)

*   Tests added/updated (unit/integration where appropriate)
*   Lint / typecheck / CI green
*   Docs/notes updated if behavior changes
*   Rollout/rollback considered if risky

## Out of Scope (explicit)

*   Adding new Webview features.
*   Refactoring the internal logic of the handlers (only their registration/dispatch).

## Technical Notes

*   Files impacted: `src/views/GitGraphViewProvider.ts`, `src/views/handlers/`.
*   Consider creating an `IHandler` interface.
