# Refactor GitService to be a Deep Module

## Goal

Refactor `GitService` from a shallow facade that flattens dozens of sub-service methods into a deep module that provides better leverage and locality. Instead of manually delegating every method, `GitService` should expose logical sub-modules or provide higher-level abstractions that group related operations.

## What I already know

* `GitService` currently flattens methods from `LogEngine`, `RefManager`, `WorkflowScribe`, `FileInspector`, and `ConfigManager`.
* There are over 50 methods in `GitService`, most of which are 1-line delegates.
* `GitGraphViewProvider`, `GitCommandHandler`, `SettingsHandler`, and `UIConverter` all depend heavily on these flattened methods.
* VDM (`ViewDataManager`) currently exposes `GitService` directly, allowing callers to access all these flattened methods.

## Assumptions (temporary)

* Grouping methods into logical namespaces (e.g., `git.log`, `git.refs`, `git.workflow`) will improve navigability.
* Most callers only need a subset of these namespaces.
* Deepening the module will reduce the maintenance overhead when adding new Git functionality.

## Open Questions

* Should we use getter properties to expose sub-modules (e.g., `gitService.log.getGitLog()`) or keep some high-level "frequent" methods at the top level?
* How should we handle common dependencies (like `GitRunner`) across these sub-modules?

## Decision (ADR-lite)

**Context**: `GitService` is a shallow facade flattening ~50 methods, making it hard to navigate and maintain.
**Decision**: Refactor `GitService` using a **Domain Style** deep module approach. Methods will be grouped into logical domains: `history`, `refs`, `ops`, `files`, and `config`.
**Consequences**: Callers will use `gitService.history.getGitLog()` instead of `gitService.getGitLog()`. This increases depth and improves locality by grouping related operations. It requires a significant update to all call sites.

## Requirements (evolving)

* [ ] Reorganize `GitService` into nested domain objects: `history`, `refs`, `ops`, `files`, and `config`.
* [ ] Maintain the single `GitService` instance per `cwd` in `DataManagerRegistry`.
* [ ] **Optimize `ViewDataManager` (VDM)**: Ensure VDM interface reflects the new domain structure or provides higher-level leverage for data access.
* [ ] Update all call sites in Handlers, Providers, and UIConverters.
* [ ] Ensure `GitService` still holds the shared `GitRunner` and `cwd` context.

## Technical Approach

1. **Internal Restructuring**: Move delegated methods in `GitService` into domain-specific objects (`history`, `refs`, `ops`, `files`, `config`).
2. **VDM Alignment**: Update `IViewDataManager` to expose domain-specific properties that proxy to `GitService` or provide aggregated data.
3. **Incremental Call-site Updates**: Update `UIConverter` first, followed by handlers (`GitCommandHandler`, `SettingsHandler`), and finally the `GitGraphViewProvider`.
4. **Cleanup**: Remove legacy flattened methods from `GitService` once all call sites are migrated.

## Acceptance Criteria (evolving)

* [ ] `GitService` interface is significantly smaller (fewer top-level methods).
* [ ] All existing Git functionality remains functional.
* [ ] Type safety is maintained throughout the refactoring.
* [ ] Unit tests for `GitService` and its callers pass.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* Changing the internal implementation of `LogEngine`, `RefManager`, etc. (this is a structural refactor).
* Refactoring `GitWorkflowEngine` (unless directly impacted by `GitService` changes).

## Technical Notes

* Files impacted: `src/git/core/GitService.ts`, `src/views/GitGraphViewProvider.ts`, `src/views/handlers/*.ts`, `src/views/UIConverter.ts`, `src/views/ViewDataManager.ts`.
