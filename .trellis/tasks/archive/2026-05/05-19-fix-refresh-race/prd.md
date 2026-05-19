# Fix Race Condition in Webview Initialization and Refresh Logic

## Background
The user reports that the Git graph view sometimes fails to refresh or shows stale data when reopened (specifically when the sidebar view is hidden and then shown again, or when a new view is created).

Analysis reveals a race condition in `resolveWebviewView` and `updateWebview`:
1. `resolveWebviewView` calls `updateWebview` (async) but does not await it.
2. `resolveWebviewView` sets `this._initialized = true` synchronously.
3. `updateWebview` sets `this._initialized = false` at its start.
4. Because of step 2 and 3, `_initialized` is TRUE during the data fetch in `updateWebview`.
5. If a git change happens now, `refresh()` runs because `_initialized` is true.
6. `refresh()` sends data to the webview via `postToWebview`.
7. If `updateWebview` hasn't set `webview.html` yet, the message is lost.
8. `refresh()` doesn't set `_pendingRefresh` because it thinks it succeeded.
9. `updateWebview` finishes and sets `webview.html` with data it fetched *before* the change.
10. The view stays stale.

## Requirements
1. **Fix Initialization State**: `_initialized` should only be set to `true` when the webview is actually ready to receive messages.
2. **Handle Reentrancy**: `updateWebview` should use the `_refreshing` flag to prevent concurrent data fetches with `refresh()`.
3. **Webview Ready Signal**: Implement a `ready` message from the webview to the backend. The backend should only send data updates after receiving this signal.
4. **Visibility Refresh**: Ensure that revealing a hidden view always triggers a refresh check, especially if changes happened while it was hidden.

## Success Criteria
- Opening/Reopening the Git Wiz view always shows the latest git state.
- No parallel data fetches between `updateWebview` and `refresh`.
- Robust handling of view visibility changes.
