# Localize warning message and other strings in GraphView

## Goal

Internationalize strings in `GraphView.tsx`, specifically the warning message shown for duplicate commits and the "Files modified in" label, supporting English and Chinese based on the current locale.

## What I already know

*   The warning message is located in `src/webview/graph/GraphView.tsx`.
*   A translation utility `t` and localization mapping exist in `src/webview/settings/i18n.ts`.
*   The current locale is likely passed to the webview or available via state/props.
*   Strings needing localization:
    1.  Duplicate commit warning message.
    2.  "Files modified in" label.

## Assumptions (temporary)

*   `GraphView` has access to the current locale (either from props or global state).
*   We can use simple string concatenation or placeholders for dynamic parts like `{currentBranch}` and `{commit.shortHash}`.

## Open Questions

*   How is the `locale` passed to `GraphView`? Is it already in the `GraphView` props?

## Requirements (evolving)

*   Add translation keys to `src/webview/settings/i18n.ts` for:
    *   `duplicateCommitWarningPre` / `duplicateCommitWarningPost`
    *   `filesModifiedIn`
*   Update `src/webview/graph/GraphView.tsx` to use the `t` function with these keys.

## Acceptance Criteria (evolving)

*   [ ] Chinese translations are correctly displayed when the locale is Chinese.
*   [ ] English translations are correctly displayed when the locale is English or other.
*   [ ] Dynamic values like branch name and commit hash are preserved correctly.

## Definition of Done (team quality bar)

*   No hardcoded English strings in the affected sections of `GraphView.tsx`.
*   Type-check passes.
*   Visual verification (if possible).
