# Add confirmation for removing remote in SettingsForm

## Goal

Add a secondary confirmation dialog when a user attempts to remove a remote from the settings view to prevent accidental deletions.

## What I already know

- `src/webview/settings/SettingsForm.tsx` sends a `settingsRemoveRemote` message to the extension.
- `src/core/settingsHandler.ts` handles this message and calls `_gitService.removeRemote`.
- The project has an i18n system.
- VS Code native dialogs are preferred for consistency.

## Assumptions (temporary)

- I will implement the confirmation in `src/core/settingsHandler.ts` using `vscode.window.showWarningMessage` with `{ modal: true }`.
- This approach is better than `window.confirm` in the webview as it matches the VS Code look and feel.

## Open Questions

- Should the confirmation be optional (e.g., a "Don't show again" checkbox)? (For now, I'll keep it simple and always show it).

## Requirements (evolving)

- Add `removeRemoteConfirm` translation keys to `src/locale/i18n.ts` (ZH and EN).
- Update `src/core/settingsHandler.ts` to show a modal warning message before proceeding with removal.
- Ensure the confirmation message includes the name of the remote being removed.

## Acceptance Criteria (evolving)

- [ ] Clicking "✕" on a remote in the settings view triggers a VS Code confirmation dialog.
- [ ] The dialog shows the correct remote name.
- [ ] The remote is only removed if the user confirms.
- [ ] Translations for English and Chinese are correct.

## Definition of Done (team quality bar)

- [ ] Lint / typecheck pass.
- [ ] Manual verification in VS Code (if possible, otherwise logic check).
- [ ] No regression in remote listing after removal.

## Out of Scope (explicit)

- Adding confirmation to other settings changes.

## Technical Notes

### New i18n keys:
- `removeRemoteConfirm`: "Are you sure you want to remove remote \"{name}\"?" / "确定要移除远程仓库 \"{name}\" 吗？"
