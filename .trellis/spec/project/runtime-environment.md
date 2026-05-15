# Runtime Environment Specification

> Executable requirements and standards for the development environment.

---

## 1. Core Runtime
- **Node.js**: `>= 24.0.0` (Use `.nvmrc`)
- **Package Manager**: `pnpm >= 10.30.0`
- **TypeScript**: `^5.0.0`

## 2. Editor Standards
- **VS Code**: `^1.75.0`
- **Linting**: ESLint `^10.0.3` with `@antfu/eslint-config`
- **Commit Messages**: Conventional Commits (enforced by Husky + Commitlint)

## 3. Build & Test
- **Webview Bundler**: `esbuild ^0.27.4`
- **Test Runner**: `Vitest ^4.1.0`

## 4. Key Environment Contracts

### Dependencies
- **Strict pnpm**: Lockfile (`pnpm-lock.yaml`) must be respected. No `npm` or `yarn` usage.
- **Node built-ins**: Prefer Node built-ins (like `child_process`, `fs`, `path`) over external libraries for git operations and file handling.

### Tooling
- **Pre-commit Hooks**: Mandatory Husky hooks for linting (`lint-staged`) and commit message validation.

## 5. Verification Matrix
- `pnpm run compile` -> Full project compilation and webview bundling.
- `pnpm test` -> Run all unit and integration tests.
- `pnpm run watch:webview` -> Real-time bundling for webview development.

## 6. Required Commands
| Action | Command | Expected Outcome |
|--------|---------|------------------|
| Setup | `pnpm install` | Clean `node_modules` + `pnpm-lock.yaml` sync |
| Build | `pnpm run compile` | Artifacts in `out/` |
| Test | `pnpm test` | All tests green |
| Lint | `npx eslint .` | Zero errors/warnings |

## 7. Wrong vs Correct
#### Wrong
```bash
# Using npm
npm install
# Skipping commit hooks
git commit -m "fixed stuff" --no-verify
```

#### Correct
```bash
# Using pnpm
pnpm install
# Following conventional commits
git commit -m "fix: resolve path-id stabilization logic"
```
