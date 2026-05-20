# Internationalize notification messages in SettingsHandler

## Goal

Internationalize the strings used in `src/core/settingsHandler.ts` to support both English and Chinese. This includes input box prompts, placeholders, and error/success messages.

## What I already know

- The project uses a custom i18n mechanism in `src/locale/i18n.ts`.
- The `t` function in `src/locale/i18n.ts` handles translations with variable substitution.
- `vscode.env.language` can be used to determine the current IDE language.
- `SettingsHandler` currently uses hardcoded English strings.

## Assumptions (temporary)

- I should add new keys to `src/locale/i18n.ts` for all strings in `SettingsHandler`.
- I will use `vscode.env.language` as the first argument to `t()`.

## Open Questions

- Should I pass the locale from `GitGraphViewProvider` or just use `vscode.env.language` inside `SettingsHandler`? (I'll use `vscode.env.language` for simplicity).

## Requirements (evolving)

- Identify all hardcoded strings in `src/core/settingsHandler.ts`.
- Add corresponding keys and translations (EN and ZH) to `src/locale/i18n.ts`.
- Replace hardcoded strings in `src/core/settingsHandler.ts` with calls to `t()`.

## Acceptance Criteria (evolving)

- [ ] All prompts and placeholders in `SettingsHandler` are translated.
- [ ] Success and error notifications in `SettingsHandler` are translated.
- [ ] Variable substitution (e.g., remote name, error message) works correctly.
- [ ] Lint and typecheck pass.

## Definition of Done (team quality bar)

- Tests added/updated (if applicable)
- Lint / typecheck / CI green
- No hardcoded strings in `SettingsHandler`

## Out of Scope (explicit)

- Internationalizing other parts of the extension not mentioned.

## Technical Notes

### Strings to translate:
1. `Remote name` (prompt)
2. `origin` (placeHolder)
3. `Remote URL for "{name}"` (prompt)
4. `https://github.com/user/repo.git` (placeHolder)
5. `Failed to add remote "{name}": {error}` (error)
6. `Successfully fetched from {name}` (info)
7. `Failed to fetch from {name}: {error}` (error)
8. `Failed to remove remote: {error}` (error)
