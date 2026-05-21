# Journal - tiemay (Part 1)

> AI development session journal
> Started: 2026-05-07

---



## Session 1: Context menu beautify & settings i18n

**Date**: 2026-05-09
**Task**: Context menu beautify & settings i18n
**Branch**: `main`

### Summary

Reorganized context menu item grouping with separators; removed Edit Commit Message feature; added Copy Commit Message in context menu; added user-select: none to commit rows; translated settings modal content to Chinese

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c886493` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Settings i18n with Chinese/English support

**Date**: 2026-05-09
**Task**: Settings i18n with Chinese/English support
**Branch**: `main`

### Summary

Created i18n.ts with zh/en translation dictionary; added locale field to SettingsData; replaced all hardcoded SettingsForm text with t(locale, key) calls; backend passes vscode.env.language to webview; zh-prefixed locales display Chinese, all others fall back to English

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6766521` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Remove Amend Commit Feature

**Date**: 2026-05-13
**Task**: Remove Amend Commit Feature
**Branch**: `main`

### Summary

Completely removed the 'amend commit' functionality across frontend (GraphView context menu), messaging (gitGraphView), logic (gitOperations), and documentation (README/README.zh-CN). Verified with lint, typecheck, and existing unit tests.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `36af15f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: Fix Branch Highlighting Logic

**Date**: 2026-05-13
**Task**: Fix Branch Highlighting Logic
**Branch**: `main`

### Summary

Fixed bugs in current branch highlighting logic by: 1) Switching to \x1f delimiter in git log output to avoid conflicts; 2) Standardizing commit signature generation with a shared utility and consistent trimming; 3) Implementing Head Hash-based cache invalidation in the webview provider. Verified with expanded unit tests.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `bcdd6b3` | (see git log) |
| `31077a7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: Tiered Branch Highlighting with Async Verification

**Date**: 2026-05-13
**Task**: Tiered Branch Highlighting with Async Verification
**Branch**: `main`

### Summary

Implemented a 3-tier branch highlighting system: Metadata matching (Instant) -> Fingerprint (numstat) -> Content (patch-id). Included an AsyncHighlightVerifier with concurrency control (max 3) to prevent git command storms. Added a yellow question mark icon and tooltip in the UI to indicate pending verification status, which upgrades to a full highlight or removal upon completion.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `3287166` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: Fix Stale View After Reopen

**Date**: 2026-05-13
**Task**: Fix Stale View After Reopen
**Branch**: `main`

### Summary

Reset all critical view state (loadedCount, searchFilters, highlighting cache, and verifier queue) in the onDidDispose handler of the webview provider. This ensures a fresh load of commits and clear filters whenever the panel is closed and reopened.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `56d9ca9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: Refine Git Watcher & Quality Guidelines

**Date**: 2026-05-14
**Task**: Refine Git Watcher & Quality Guidelines
**Branch**: `main`

### Summary

Refined Git filesystem watcher to use precise paths (HEAD, refs, packed-refs), avoiding unnecessary refreshes from index/objects changes. Improved refresh logic with concurrency guards and resource cleanup. Updated frontend quality guidelines to mandate precise watching and proper disposal.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `69c49ad` | (see git log) |
| `32bc3f7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: Deepen GitService & Enforce GitRunner Seam

**Date**: 2026-05-14
**Task**: Deepen GitService & Enforce GitRunner Seam
**Branch**: `main`

### Summary

Refactored GitOperations into a deep GitService, decoupled from VS Code UI. Enforced the GitRunner seam for all Git executions. Moved Git command logic from extension.ts to GitService. Added comprehensive unit tests for GitService.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b8de511` | (see git log) |
| `3f8f61f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: Decompose GitGraphViewProvider

**Date**: 2026-05-14
**Task**: Decompose GitGraphViewProvider
**Branch**: `main`

### Summary

Decomposed GitGraphViewProvider (1006→769 lines) by extracting AsyncHighlightVerifier into src/git/ and splitting handleMessage into GitCommandHandler, SettingsHandler, and FileHandler. All handlers implement Disposable with dependency injection of only needed services. Updated quality-guidelines.md with handler-based routing pattern.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9d812b1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: Make the HEAD branch the main leftmost lane in the git graph visualization.

**Date**: 2026-05-15
**Task**: Make the HEAD branch the main leftmost lane in the git graph visualization.
**Branch**: `main`

### Summary

Refactored color management, enhanced graph layout computation, and updated git log arguments to include branches, tags, and remotes.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `70f689f` | (see git log) |
| `6f9fcb2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 11: Show warning for signature-matched commits with inconsistent content

**Date**: 2026-05-15
**Task**: Show warning for signature-matched commits with inconsistent content
**Branch**: `main`

### Summary

Implemented warning icons and messages for commits that match by signature but fail content verification. Added --stable flag to patch-id comparison, excluded merge commits from warnings, and updated component guidelines.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b15b803` | (see git log) |
| `229e652` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 12: Release v1.4.0 and cleanup

**Date**: 2026-05-15
**Task**: Release v1.4.0 and cleanup
**Branch**: `main`

### Summary

Bumped version to 1.4.0, updated CHANGELOG.md with recent features and improvements, and removed development sections from READMEs. Archived bootstrap, joining, and release tasks to clean up the workspace.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `3d7189b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 13: 实现 Git 工作流引擎

**Date**: 2026-05-18
**Task**: 实现 Git 工作流引擎
**Branch**: `main`

### Summary

完成了 Git Workflow Engine 的架构改进。引入了 UIService 接口以解耦 VSCode UI，实现了带有并发锁的引擎框架，并迁移了‘删除分支’和‘Cherry-pick’工作流。消除了 extension.ts 和 GitCommandHandler 之间的逻辑重复，提高了代码的局部性和可测试性。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `cfb48a0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 14: UI 优化与国际化升级

**Date**: 2026-05-18
**Task**: UI 优化与国际化升级
**Branch**: `main`

### Summary

完成了 UI 体验优化和全局国际化支持。将所有 Git 操作的进度显示移至 VSCode 状态栏，实现了统一且不遮挡编辑器的加载状态。升级了 i18n 系统，支持全局复用和占位符变量替换，完成了所有后端工作流（Checkout, Revert, Push, etc.）的文案本地化。重构并新增了多个工作流类，大幅简化了 extension.ts 的逻辑。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a7a83ab` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 15: Architectural Deepening and Decentralization

**Date**: 2026-05-18
**Task**: Architectural Deepening and Decentralization
**Branch**: `main`

### Summary

Completed two major architectural refactors: 1) Separated Domain and View models in GitCommit by extracting UI state into a Map. 2) Decentralized GitGraphViewProvider by extracting state into GraphState and delegating message handling to UIStateHandler and GitCommandHandler. Improved code modularity, locality, and testability.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `3512b0f` | (see git log) |
| `5c592e3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 16: GitService Domain-Oriented Refactor

**Date**: 2026-05-18
**Task**: GitService Domain-Oriented Refactor
**Branch**: `main`

### Summary

Refactored GitService into a domain-oriented Facade by extracting logic into LogEngine, RefManager, WorkflowScribe, FileInspector, and ConfigManager. Improved modularity and testability while preserving the existing public API.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b41dcf9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 17: Project Structure Reorganization

**Date**: 2026-05-18
**Task**: Project Structure Reorganization
**Branch**: `main`

### Summary

Completed a comprehensive reorganization of the codebase. Moved files into feature-based subdirectories (commands, core, git/core, git/highlight, git/utils, locale, views). Fixed all relative import paths across the project, including tests and webview components. Updated tsconfig.json to support DOM/JSX for all files and resolve alias discrepancies. Verified build and tests are passing.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e07aad9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 18: Fix Webview Refresh Race

**Date**: 2026-05-19
**Task**: Fix Webview Refresh Race
**Branch**: `dev`

### Summary

Fixed a race condition in webview initialization by implementing a 'ready' signal from the webview to the host. Added reentrancy protection to refresh logic and updated frontend quality guidelines to mandate this pattern.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `5359d1c` | (see git log) |
| `9dfa8c8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 19: Optimize loading UI with top progress bar

**Date**: 2026-05-19
**Task**: Optimize loading UI with top progress bar
**Branch**: `dev`

### Summary

Replaced VS Code status bar progress with a top-aligned infinite scrolling progress bar in the webview. Adjusted width to 10% and integrated with VSCodeUIService for a unified Git operation loading experience.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ae6ab1c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 20: 优化 AsyncHighlightVerifier 缓存管理

**Date**: 2026-05-19
**Task**: 优化 AsyncHighlightVerifier 缓存管理
**Branch**: `dev`

### Summary

修复了 AsyncHighlightVerifier 在 Git 状态变更时缓存陈旧的问题。在 ViewDataManager.refreshAll 中引入了立即重置逻辑，并在验证器中添加了 generation 计数器以处理异步竞态条件。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `5bb9b6b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 21: 修复 GitGraphViewProvider 竞态条件

**Date**: 2026-05-19
**Task**: 修复 GitGraphViewProvider 竞态条件
**Branch**: `dev`

### Summary

修复了 GitGraphViewProvider 中的多处竞态条件。引入了异步消息队列序列化 Webview 请求，实现了原子化的签名缓存加载锁，并修正了刷新请求中的状态合并逻辑，确保高频操作下视图状态的一致性。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `555c8c0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 22: Optimize Git Refresh Stability

**Date**: 2026-05-20
**Task**: Optimize Git Refresh Stability
**Branch**: `dev`

### Summary

Implemented lock-aware refresh logic in ViewDataManager to handle complex Git operations gracefully. Added watchers for `.git/index.lock`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, and rebase directories. Refreshes are deferred while `index.lock` exists and triggered immediately upon its release.

### Main Changes

- Added `_isLocked` and `_pendingRefresh` state to `ViewDataManager`.
- Implemented `checkInitialLockState` to detect locks at startup.
- Expanded `FileSystemWatcher` to cover all critical Git status files.
- Modified `refreshAll` to respect the repository lock state.

### Git Commits

| Hash | Message |
|------|---------|
| (pending) | feat: implement lock-aware git refresh stability |

### Testing

- [OK] Verified no compilation errors with `tsc`.
- [OK] Logic verified via static analysis: `index.lock` creation sets lock, deletion releases and triggers pending refresh.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 22: Optimize Git Refresh Stability

**Date**: 2026-05-20
**Task**: Optimize Git Refresh Stability
**Branch**: `dev`

### Summary

Implemented lock-aware refresh logic in ViewDataManager to handle complex Git operations gracefully.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `fd4d8bd` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 23: Multi-instance ViewDataManager Transition

**Date**: 2026-05-20
**Task**: Multi-instance ViewDataManager Transition
**Branch**: `dev`

### Summary

Refactored ViewDataManager from a global singleton into a controlled multi-instance architecture keyed by repository path, resolving state conflicts for multi-root workspaces.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6e621ab` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 24: Full Multi-root Workspace Support

**Date**: 2026-05-20
**Task**: Full Multi-root Workspace Support
**Branch**: `dev`

### Summary

Implemented manual repository switching in the sidebar via QuickPick, supporting multi-root workspaces with isolated ViewDataManager instances per root.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2f69dcb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 25: Internationalize SettingsHandler and add remote removal confirmation

**Date**: 2026-05-20
**Task**: Internationalize SettingsHandler and add remote removal confirmation
**Branch**: `dev`

### Summary

Internationalized notification messages and input prompts in SettingsHandler.ts. Added a modal confirmation dialog when removing a remote in SettingsForm.tsx to prevent accidental deletion.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ccea610` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 26: 修复 Switch Repository 按钮无响应并同步 Git 扩展

**Date**: 2026-05-20
**Task**: 修复 Switch Repository 按钮无响应并同步 Git 扩展
**Branch**: `dev`

### Summary

修复了在单仓库环境下点击 Switch Repository 按钮无响应的问题。重构了命令逻辑以集成官方 Git 扩展 API，支持发现子模块和嵌套仓库，并添加了中英文的‘当前已是该仓库’等提示。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `494f1ef` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 27: 重构 GitGraphViewProvider：职责拆分

**Date**: 2026-05-21
**Task**: 重构 GitGraphViewProvider：职责拆分
**Branch**: `dev`

### Summary

完成了 GitGraphViewProvider 的深度重构，将其拆分为 GitGraphViewProvider (生命周期)、RefreshManager (刷新状态机)、WebviewMessenger (消息通信) 和 UIConverter (数据转换)。消除了原有的竞态条件，并更新了前端质量规范以强制执行此架构模式。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c7a8f4b` | (see git log) |
| `651bdb1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 28: Refactor ViewDataManager with Registry and Factory

**Date**: 2026-05-21
**Task**: Refactor ViewDataManager with Registry and Factory
**Branch**: `dev`

### Summary

Implemented DataManagerRegistry and ViewDataManagerFactory to decouple ViewDataManager from its dependencies and centralize repository lifecycle management. Replaced static singleton patterns with a registry-based approach injected into GitGraphViewProvider. Fixed a multi-root workspace bug where file watchers were hardcoded to the first workspace. Added unit tests for the registry.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2960a98` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 29: Consolidate Refresh and Flow Control Logic

**Date**: 2026-05-21
**Task**: Consolidate Refresh and Flow Control Logic
**Branch**: `dev`

### Summary

Refactored the refresh flow by centralizing debounce, lock management, and state merging (e.g., resetScroll) into ViewDataManager. Simplified RefreshManager to focus strictly on view readiness and mutual exclusion. Updated GitGraphViewProvider to adapt to the new event-driven refresh pipeline. Added comprehensive unit tests for ViewDataManager's refresh logic.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e0aa94a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 30: Reorganize Handlers and Unify Naming

**Date**: 2026-05-21
**Task**: Reorganize Handlers and Unify Naming
**Branch**: `dev`

### Summary

Moved Webview message handlers (FileHandler, GitCommandHandler, SettingsHandler, UIStateHandler) from src/core/ and src/commands/ to a dedicated src/views/handlers/ directory. Unified naming convention to PascalCase for these classes and renamed src/core/graphState.ts to src/core/GraphState.ts. Created an index.ts in the handlers directory for consolidated exports and updated all import references accordingly. Cleaned up the now-empty src/commands/ directory.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `fa41473` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 31: Improve Webview Messaging Type Safety

**Date**: 2026-05-21
**Task**: Improve Webview Messaging Type Safety
**Branch**: `dev`

### Summary

Introduced a strong-typed Webview communication protocol using discriminated unions. Refactored WebviewMessenger to enforce type constraints on outgoing messages. Updated all message handlers to use the new protocol, eliminating numerous non-null assertions and improving code reliability. Consolidated the messaging architecture by moving the protocol definition to a shared type file.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2960a98` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 32: Modularize extension.ts and Decouple Command Registration

**Date**: 2026-05-21
**Task**: Modularize extension.ts and Decouple Command Registration
**Branch**: `dev`

### Summary

Drastically reduced the size of extension.ts by moving VSCode command registration into a modular CommandManager architecture. Introduced ICommandGroup interface and split commands into GitCommandGroup and ViewCommandGroup. Extracted TextDocumentContentProvider into GitWizContentProvider. The entry point now focus solely on high-level component assembly, improving maintainability and readability.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2960a98` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
