# 研究报告：Git 操作检测与刷新稳定性优化

- **查询**: 研究标准 Git 文件和目录，以指示正在进行的 Git 操作（rebase, merge, cherry-pick, revert, bisect）和仓库锁定。
- **范围**: 内部 (VS Code 扩展开发) / 外部 (Git 内部机制)
- **日期**: 2025-05-20

## 发现

### 核心 Git 状态指示文件

下表列出了 Git 在执行各种复杂操作时在 `.git/` 目录下创建的标准文件或目录：

| 操作类型 | 指示文件/目录 | 说明 |
| :--- | :--- | :--- |
| **合并 (Merge)** | `.git/MERGE_HEAD` | 正在合并的提交 Hash。冲突时或提交前存在。 |
| | `.git/MERGE_MSG` | 预备的合并提交消息。 |
| | `.git/MERGE_MODE` | 合并模式元数据。 |
| **变基 (Rebase)** | `.git/rebase-merge/` | 交互式变基或 `--merge` 变基时使用的目录。 |
| | `.git/rebase-apply/` | 普通变基（补丁模式）时使用的目录。 |
| **樱桃摘取 (Cherry-pick)** | `.git/CHERRY_PICK_HEAD` | 正在被 cherry-pick 的提交 Hash。 |
| | `.git/sequencer/` | 序列号管理器目录（处理多提交操作）。 |
| **回滚 (Revert)** | `.git/REVERT_HEAD` | 正在被 revert 的提交 Hash。 |
| | `.git/sequencer/` | 同上，用于管理回滚序列。 |
| **二分查找 (Bisect)** | `.git/BISECT_LOG` | 记录二分查找的步骤。 |
| | `.git/BISECT_START` | 二分查找开始时的分支/提交。 |
| **仓库锁定 (Lock)** | `.git/index.lock` | 索引文件正在被修改（如 `add`, `commit`, `checkout`）。 |
| | `.git/refs/heads/*.lock` | 特定引用正在被修改。 |

### 稳定性分析与建议

为了确保 IDE 扩展（如 Git Wiz）在复杂操作期间保持视图稳定性，建议采取以下策略：

#### 1. 监控文件的可靠性
- **`index.lock`**: 最可靠的“繁忙”信号。如果此文件存在，Git 正在写入索引。此时刷新视图可能会读取到不完整的数据或遇到权限冲突。
- **操作指示器（如 `MERGE_HEAD`）**: 非常可靠的“持久状态”信号。它们会一直存在，直到操作完成、取消或解决冲突。

#### 2. 优化刷新触发逻辑
当前的 500ms 防抖（Debounce）虽然有用，但在耗时较长的操作中可能在中间状态触发。
- **改进方案 A (延后触发)**：监听 `index.lock`。
    - 当 `index.lock` 被创建时，暂停所有自动刷新。
    - 当 `index.lock` 被删除时，触发一次刷新（这通常意味着 Git 操作刚刚完成，数据已稳定）。
- **改进方案 B (状态感知)**：监听变基/合并目录。
    - 当检测到 `.git/rebase-merge` 或 `.git/rebase-apply` 创建或删除时，说明仓库进入了显著不同的状态，应优先处理。

#### 3. 推荐的监听模式 (VS Code)
在 `ViewDataManager.ts` 中增加以下路径的监听：
- `.git/index.lock`
- `.git/MERGE_HEAD`
- `.git/rebase-merge/**`
- `.git/rebase-apply/**`
- `.git/CHERRY_PICK_HEAD`
- `.git/REVERT_HEAD`

### 相关参考

- [VS Code 内置 Git 插件源码 (repository.ts)](https://github.com/microsoft/vscode/blob/main/extensions/git/src/repository.ts)：该文件展示了 VS Code 如何通过检查上述文件来维护其 `RepositoryState`。

## 待办与风险

- **性能风险**：频繁监听 `.git` 目录下的所有变化可能会产生性能开销。应尽可能使用精确的 Glob 模式。
- **非标准 Git**：某些 Git 客户端（如某些旧版本的 LibGit2）可能在文件命名上略有差异，但上述列表涵盖了 99% 的主流 Git 环境。
