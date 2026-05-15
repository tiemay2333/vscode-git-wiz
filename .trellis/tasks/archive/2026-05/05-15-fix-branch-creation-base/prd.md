# fix: branch creation base branch and unify behavior

## Goal

Fix the "Create New Branch Here" context menu item in the branch panel to use the selected branch as the base. Also unify the behavior across the extension: creating a branch should always switch (checkout) to it.

## What I already know

* The context menu item "Create New Branch Here" in `BranchPanel.tsx` calls `handleAction("createBranch", ctxMenu.branch.fullName)`.
* This sends a message to the extension which executes the `git-wiz.createBranch` command.
* The `git-wiz.createBranch` command implementation in `extension.ts` calls `gitService.checkoutBranch(newBranchName, { create: true })`.
* `gitService.checkoutBranch` in `gitOperations.ts` does not accept a start point, so it defaults to the current HEAD.
* Discrepancy: Creating a branch from the **Graph View** uses the correct commit hash as base but **does not** switch to the new branch. Creating from the **Branch Panel** switches to the branch but uses the **wrong base** (HEAD).

## Assumptions (temporary)

* We want to unify the behavior: creating a branch always switches to it.
* For remote branches, we should use the remote branch as the start point.

## Open Questions

(None)

## Requirements (evolving)

* `gitService.checkoutBranch` should accept an optional `startPoint`.
* `git-wiz.createBranch` command in `extension.ts` should pass the `sourceBranch` as the `startPoint` to `checkoutBranch`.
* `createBranchFromCommit` in `GitGraphViewProvider` should call `checkoutBranch` with `create: true` instead of just `createBranch` to ensure switching.
* Ensure all branch creation paths refresh both the Graph View and the Branch Panel.

## Acceptance Criteria (evolving)

* [ ] Right-clicking a branch (local or remote) in the Branch Panel and selecting "Create New Branch Here" creates a branch starting from that branch and switches to it.
* [ ] Creating a branch from a commit in the Graph View creates the branch and switches to it.
* [ ] The graph view refreshes and highlights the new HEAD after creation.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* Refactoring the entire branch creation UI.

## Technical Notes

* `src/extension.ts`
* `src/gitOperations.ts`
* `src/webview/branches/BranchPanel.tsx`
* `src/gitGraphView.ts`
