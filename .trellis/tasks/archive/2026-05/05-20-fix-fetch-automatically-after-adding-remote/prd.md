# fix: fetch automatically after adding remote

## Goal

当用户通过本插件添加一个新的远程仓库（Remote）时，目前插件仅执行 `git remote add` 命令。这会导致用户在添加后无法立即看到该远程仓库的分支和提交，必须手动执行 fetch 操作。本任务旨在实现“添加远程仓库后自动 fetch”的功能，提升用户体验。

## What I already know

* 核心逻辑位于 `src/git/core/RefManager.ts` 的 `addRemote` 方法。
* 目前 `addRemote` 仅调用 `this.runner.exec(["remote", "add", name, url])`。
* `GitService.ts` 只是 `RefManager` 的简单包装。
* 整个 `src/git/core/` 目录下目前没有 `fetch` 方法的定义。

## Requirements

1. **实现 Fetch 操作**：在 `RefManager` 中添加 `fetch(remoteName?: string)` 方法。
2. **自动拉取**：在 `addRemote` 成功执行后，自动调用 `fetch(name)`。
3. **手动拉取按钮**：在设置页面的远程仓库列表中，删除按钮左侧添加一个 Fetch 图标，允许用户手动刷新特定远程仓库。
4. **健壮性**：即使 `fetch` 失败（例如网络问题），也不应影响远程仓库已添加的事实，但需要确保错误被捕获或记录。
5. **UI 反馈**：fetch 过程中应有适当的加载提示。

## Acceptance Criteria

* [ ] 在 `RefManager.ts` 中新增 `fetch` 方法。
* [ ] 修改 `RefManager.addRemote`，使其在成功后执行 `fetch`。
* [ ] 在设置页面远程仓库列表的每一行删除按钮左侧，添加 Fetch 图标并绑定点击事件。
* [ ] 验证：添加一个新的远程仓库后，自动拉取。
* [ ] 验证：点击手动 Fetch 图标，能成功拉取该仓库的分支。

## Definition of Done

* 测试通过（手动验证或单元测试）。
* Lint / Typecheck 通过。
* 代码符合项目规范。

## Out of Scope

* 实现完整的 `git pull` 逻辑（仅限 `fetch`）。
* 处理复杂的认证失败交互（目前由底层的 Git 执行环境处理）。

## Technical Notes

* 修改文件：
    - `src/git/core/RefManager.ts`
    - `src/git/core/GitService.ts` (同步接口)
* `fetch` 命令：`git fetch <remoteName>`
