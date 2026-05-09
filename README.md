# GitWiz

<h3 align="center">
    <a target="_blank" href="https://github.com/tiemay2333/vscode-git-wiz/blob/main/README.md">English</a> |
    <a target="_blank" href="https://github.com/tiemay2333/vscode-git-wiz/blob/main/README.zh-CN.md">简体中文</a>
</h3>

A minimalist Git extension for VS Code with a canvas-rendered commit graph and visual branch management — no bloat, no distractions.

![screenshot](./images/screenshot.png)

## Features

### Git Graph
- **Commit history** — scrollable list of commits with author, date, and hash
- **Branch path graph** — visual tracking of branch/merge topology (toggle on/off)
- **Highlight current branch** — dim commits not on the current branch
- **File diff view** — click a commit to see changed files with insertions/deletions inline

### Branch Management
- **Tree-organized branch list** — branches with `/` (e.g. `feature/login`) are grouped into folders
- **Checkout** — switch to any local or remote branch (auto-tracking for remotes)
- **Create branch** — create and switch to a new branch from any existing branch
- **Delete branch** — with safety checks (not-fully-merged warning, force delete option)
- **Delete remote branch** — delete branches from remote repositories
- **Rebase** — rebase current branch onto any other branch
- **Merge** — merge any branch into current branch
- **Multi-delete** — select and delete multiple branches at once
- **Bulk folder delete** — delete all branches in a group folder at once

### Tag Management
- **Create branch from tag** — start a new branch at a tag
- **Push tag** — push a tag to remote
- **Delete tag** — delete local tags

### Commit Operations (right-click context menu)
| Action | Description |
|--------|-------------|
| Cherry-pick | Apply commit to current branch |
| Copy Hash | Copy full commit hash to clipboard |
| Copy Commit Message | Copy commit message text to clipboard |
| Revert | Create a revert commit |
| Reset to commit | Soft-reset branch to this commit |
| Amend | Amend the HEAD commit |
| Drop commit | Remove commit from history (requires confirmation) |
| Squash commits | Combine multiple consecutive commits into one |
| Cherry-pick range | Apply a range of commits to current branch |
| Revert range | Revert a range of commits |

### Remote Operations
- **Fetch** — fetch from all remotes
- **Pull** — pull current branch
- **Push** — push current branch (auto-sets upstream if missing)
- **Force push** — push with `--force-with-lease` (with confirmation)
- **Remote management** — add/remove remotes in settings

### File History
- Right-click any file in the editor or explorer → "Git Wiz: Show File History" to filter the graph to only that file's commits
- Uses the standard VS Code file picker integration

### Internationalization
- Supports **English** and **Chinese (Simplified)**
- Automatically matches VS Code display language
- Settings modal dialog fully localized

## Requirements

- VS Code `^1.75.0`
- Node.js `>=24`
- pnpm `>=10`

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=tiemay.git-wiz-v2) or search for **GitWiz** in the Extensions view (`Ctrl+Shift+X`).

## Usage

### Open the Graph View
- Click the **Git Wiz** status bar item
- Or run `Git Wiz: Show Graph` from the command palette (`Ctrl+Shift+P`)
- Or click the **Git Wiz** panel in the activity bar's SCM section

### Toolbar Buttons
Buttons in the graph view title bar:
| Button | Action |
|--------|--------|
| Fetch | `git fetch --all` |
| Pull | `git pull` |
| Push | `git push` (auto-set upstream) |
| Force Push | `git push --force-with-lease` (with confirmation) |
| Refresh | Reload branches |
| Settings | Open settings modal |

### Branch Panel Context Menu (right-click)
| Menu Item | Local | Remote | Tag |
|-----------|-------|--------|-----|
| Checkout | ✓ | ✓ | |
| Create New Branch Here | ✓ | | |
| Create Branch from Tag | | | ✓ |
| Push Tag | | | ✓ |
| Delete | ✓ | | |
| Delete Remote Branch | | ✓ | |
| Delete Tag | | | ✓ |
| Rebase Current onto This | ✓ | ✓ | ✓ |
| Merge into Current | ✓ | ✓ | ✓ |

## Configuration

Settings available in VS Code settings (`Ctrl+,`), search for `git-wiz`:

| Setting | Default | Description |
|---------|---------|-------------|
| `git-wiz.showStatusBarItem` | `true` | Show status bar item |
| `git-wiz.filesViewMode` | `"list"` | Default file view: `list` or `tree` |
| `git-wiz.commitDetailsViewMode` | `"list"` | Commit details file view: `list` or `tree` |
| `git-wiz.highlightCurrentBranch` | `false` | Highlight current branch commits |
| `git-wiz.showTags` | `true` | Show tag badges in graph |
| `git-wiz.showRemoteBranches` | `true` | Show remote branch names |
| `git-wiz.showGraph` | `true` | Show branch path graph |

The same options can also be toggled from the **Settings** button (gear icon) in the graph view title bar.

## Development

```bash
# Clone
git clone https://github.com/tiemay2333/vscode-git-wiz.git

# Install dependencies
pnpm install

# Compile
pnpm run compile

# Watch mode (extension host)
pnpm run watch

# Watch mode (webview, rebuilds on save)
pnpm run watch:webview

# Run tests
pnpm test
```

### Project Structure

```
src/
├── extension.ts              # Extension entry, command registrations
├── gitGraphView.ts           # Webview provider, message handling
├── gitOperations.ts          # Git operations (checkout, merge, rebase, etc.)
├── gitParser.ts              # Git log output parser
├── git/                      # Git runner and rebase scripts
├── webview/
│   ├── index.tsx             # Webview entry
│   ├── graph/                # Commit graph view (React)
│   │   ├── GraphView.tsx     # Main graph component
│   │   ├── CommitRow.tsx     # Commit row with ref badges
│   │   └── graphLayout.ts    # Branch path layout algorithm
│   ├── branches/
│   │   └── BranchPanel.tsx   # Branch tree panel
│   └── settings/
│       ├── SettingsForm.tsx  # Settings modal form
│       └── i18n.ts           # Internationalization dictionary
└── webviewContent.ts         # Webview HTML generator
```

## License

MIT
