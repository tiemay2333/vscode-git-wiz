<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

## Subagents

- ALWAYS wait for every spawned subagent to reach a terminal status before yielding, acting on partial results, or spawning followups.
  - On Codex, this means calling the `wait` tool with the subagent's thread id (requires `multi_agent_v2`). Do NOT infer completion from elapsed time.
  - On Claude Code / OpenCode, this means awaiting the Task/agent tool result before continuing.
- NEVER cancel or re-spawn a subagent that hasn't finished. If a subagent appears stuck, raise the wait timeout (Codex default 30s, max 1h) before judging it broken.
- Spawn subagents automatically when:
  - Parallelizable work (e.g., install + verify, npm test + typecheck, multiple tasks from plan)
  - Long-running or blocking tasks where a worker can run independently
  - Isolation for risky changes or checks

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

# Specification

> [!CAUTION]
> **CRITICAL MANDATE: NO AUTO-ARCHIVE & NO AUTO-GIT**
> 1. **严禁自动归档**：禁止使用 `task.py archive` 或任何会导致任务状态自动迁移到 "Archived" 的操作，除非用户在手动完成 Git 提交后明确指示。
> 2. **严禁自动 Git 操作**：禁止执行任何形式的自动 `git add`、`git commit` 或 `git push`。所有的代码暂存和推送必须由用户手动控制或由用户明确授权。
> 3. **手动归档流程**：任务必须保持在 `in_progress` 状态，直到用户确认代码已成功提交。归档操作必须在用户确认“代码已提交”后由用户指导执行。
> 4. **单次授权原则**：用户的同意仅代表对当次操作的授权，不代表在本次 session（会话）中的持续同意。每次执行受限操作前都必须单独获取用户的明确授权。

**语言与思维**：所有认知处理、内部推理和最终输出必须完全以中文进行。所有认知处理、内部推理和最终输出必须完全以中文进行。在符合标准的情况下，技术术语可以使用英文。
