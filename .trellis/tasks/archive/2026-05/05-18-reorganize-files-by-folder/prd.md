# brainstorm: reorganize-files-by-folder

## Goal

对项目中的所有文件（包含 `src/` 及其子文件夹下的所有文件）按文件夹的方式进行全面归纳整理，并进行物理移动，以优化代码库结构，提高可维护性。

## Requirements

* 将 `src/` 下的所有文件按功能模块重新分类并移动。
* 保持 `extension.ts` 在根目录。
* `src/test/` 目录同步调整以镜像新的代码结构。
* 更新所有受影响的 `import` 路径（包括源代码和测试文件）。

## Acceptance Criteria

* [ ] `src/` 目录结构完全符合新的设计规范。
* [ ] 运行构建脚本（如 `npm run compile` 或 `tsc`）无类型或路径错误。
* [ ] 所有的自动化测试通过 (`npm test` 或对应的测试脚本)。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope

* 重构代码内部的业务逻辑（仅限于物理移动和路径更新）。
* 添加新功能。

## Technical Approach

### 目标目录结构

```text
src/
├── extension.ts          (入口文件保留)
├── commands/
│   └── gitCommandHandler.ts
├── core/                 (核心状态与配置)
│   ├── graphState.ts
│   ├── settingsHandler.ts
│   ├── uiStateHandler.ts
│   └── fileHandler.ts
├── git/
│   ├── core/             (Git 核心引擎)
│   │   ├── GitRunner.ts
│   │   ├── LogEngine.ts
│   │   ├── RefManager.ts
│   │   ├── ConfigManager.ts
│   │   ├── FileInspector.ts
│   │   ├── gitOperations.ts
│   │   └── gitParser.ts
│   ├── highlight/        (高亮验证)
│   │   ├── commitHighlight.ts
│   │   └── AsyncHighlightVerifier.ts
│   ├── utils/            (脚本等杂项)
│   │   ├── rebaseScripts.ts
│   │   └── scriptedEditor.ts
│   └── workflow/         (工作流引擎，保持现有内部结构)
│       ├── WorkflowScribe.ts
│       ├── engine.ts, base.ts ...
│       └── impl/...
├── locale/               (本地化)
│   └── i18n.ts
├── views/                (VS Code 视图容器)
│   ├── gitGraphView.ts
│   └── webviewContent.ts
└── webview/              (React 前端代码，保持其现有的内部结构基本不变)
    ├── index.tsx
    └── ...
```

移动文件后，使用 IDE 重构工具或全局替换来修复 `import` 路径。最后运行 `tsc` 和 `test` 验证。

## Decision (ADR-lite)

**Context**: 项目存在多个松散的文件，且 `src/git/` 内部也开始变得混乱。
**Decision**: 实施全面的目录重构，基于 Feature 分层（如 commands, core, git/core, views 等）。
**Consequences**: 这是一次大范围的物理路径变更，会导致大量 `import` 路径被修改，但不会改变业务逻辑。由于是纯路径变更，通过 TypeScript 编译器可以严格保证其安全性。
