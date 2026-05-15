# PRD: Show warning for signature-matched commits with inconsistent content

## Context
When a commit matches by signature (author/subject) but fails content verification (patch-id mismatch), it's currently highlighted as if it's not on the current branch (dimmed). However, since it matched by signature, it indicates a potential relationship (e.g., a cherry-pick or a manual re-implementation) that should be flagged to the user if the content is different.

## Requirements
1.  **Warning Icon in Graph View**:
    *   In the commit list (Graph View), display a warning icon (`⚠️`) before the commit message for commits that matched by signature but failed content verification (`verificationStatus === "failed"`).
    *   The icon should have a tooltip: "存在同名的提交修改，但更改内容不一致".
2.  **Warning Message in Details Panel**:
    *   In the expanded commit details panel (the inline panel showing modified files), display a prominent warning message: "⚠️ 存在同名的提交修改，但更改内容不一致".
    *   The message should be styled with a warning color (e.g., VS Code's warning foreground).

## Acceptance Criteria
- [ ] Commits with `verificationStatus === "failed"` show a warning icon in the message cell.
- [ ] Hovering over the warning icon shows the correct tooltip.
- [ ] Expanding a commit with `verificationStatus === "failed"` shows the warning message in the header of the details panel.
