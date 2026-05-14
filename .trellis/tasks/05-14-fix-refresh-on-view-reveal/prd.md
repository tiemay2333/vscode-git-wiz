# Fix: 视图隐藏后重新显示时不刷新数据

## 问题

当 VS Code 侧边栏 WebviewView 被隐藏（切换到其他标签页）后再重新显示时，不会重新加载 git 数据。用户可能在此期间做了新提交，重新显示视图后看到的仍是旧数据。

## 根因

1. `GitGraphViewProvider.resolveWebviewView` 中未监听 `onDidChangeVisibility` 事件，视图从隐藏变为可见时不会触发刷新
2. `createOrShow` 静态方法中，当 `currentPanel` 已存在时仅调用 `reveal()` 后直接返回，不触发刷新

## 修复方案

1. 在 `resolveWebviewView` 中添加 `webviewView.onDidChangeVisibility` 监听器，视图变为可见时调用 `refresh()`
2. 在 `createOrShow` 中 `currentPanel.reveal()` 后，获取对应 provider 实例并调用 `refresh()`

## Acceptance Criteria

- [ ] 侧边栏视图隐藏后重新显示，自动刷新 git 数据
- [ ] 独立面板隐藏后重新显示（`createOrShow`），自动刷新数据
- [ ] 初始首次打开不产生多余刷新
- [ ] lint/typecheck 通过
