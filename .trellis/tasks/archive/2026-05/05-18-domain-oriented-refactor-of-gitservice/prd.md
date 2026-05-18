# Domain-oriented refactor of GitService

## Goal

Refactor the `GitService` in `src/gitOperations.ts` from a "shallow" all-in-one wrapper into a "deep" service that delegates to focused domain modules. This improves code locality, leverage, and testability by grouping related Git operations together.

## What I already know

* `GitService` currently has 50+ methods covering many domains (logs, refs, workflows, config, file inspection).
* Most methods are thin wrappers around `GitRunner.exec`.
* The codebase uses `GitService` as the primary interface for all Git logic.

## Assumptions (temporary)

* We can decompose `GitService` without breaking its existing public API (callers won't need to change immediately if `GitService` acts as a facade).
* Each new sub-module will have its own file in `src/git/`.

## Open Questions

* [Preference] Should we keep the existing `GitService` as a facade (composition) or should we update callers to use the specific sub-services directly? (Recommendation: Facade for now to minimize downstream churn, then gradually migrate callers).

## Requirements (evolving)

* **Identify Domains**: Categorize 50+ methods into LogEngine, RefManager, WorkflowScribe, FileInspector, and ConfigManager.
* **Extract Modules**: Create separate classes for each domain in `src/git/`.
* **Refactor GitService**: Use composition to delegate all methods to the new sub-modules.
* **Maintain Performance**: Ensure no performance regressions (e.g., unnecessary object creation).

## Technical Approach (Plan A: Facade Composition)

The `GitService` will be refactored to act as a **Facade** over five specialized domain modules. This preserves the existing public API while deepening the implementation through composition.

### 1. Domain Modules (to be created in `src/git/`)

*   **`LogEngine`**: Handles log fetching (`getUnfilteredLog`, `getGitLog`), hash management (`getBranchCommits`), and content identity (`getPatchId`, `getCommitFilePatchIds`).
*   **`RefManager`**: Manages references (`getBranches`, `getCurrentBranch`, `getHeadHash`, `getUpstream`) and remote configuration (`getRemotes`, `addRemote`, `removeRemote`).
*   **`WorkflowScribe`**: Executes side-effectful operations (`cherryPick`, `revert`, `rebase`, `merge`, `push`, `pull`, `fetch`).
*   **`FileInspector`**: Inspects file-level data (`getFileContentAtRev`, `getCommitFiles`, `getNumstat`).
*   **`ConfigManager`**: Manages Git configuration (`getGitConfig`, `setGitConfig`).

### 2. Implementation Steps

1.  **Extract Domain Classes**: Create the five domain classes in `src/git/`, moving logic from `GitService`.
2.  **Refactor `GitService`**: Instantiate these classes in the constructor and delegate all method calls.
3.  **Cleanup**: Remove redundant logic from `src/gitOperations.ts`.

## Acceptance Criteria (evolving)

* [ ] `src/gitOperations.ts` is significantly simplified (delegate-only).
* [ ] Each sub-module (LogEngine, etc.) is unit testable in isolation.
* [ ] All existing Git features and workflows still work.
* [ ] `npm test` passes without changes to existing tests.
