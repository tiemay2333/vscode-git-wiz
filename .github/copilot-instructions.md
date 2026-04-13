# Git Lean Project Guidelines

## Code Style
- Use **TypeScript** and **React 19** for development.
- The webview UI relies on the Canvas API for graph rendering. Keep runtime dependencies to a minimum.
- Run `pnpm run lint` (ESLint) and `pnpm run format` (Prettier) to ensure code style consistency.

## Architecture
- **Extension backend** ([src/extension.ts](src/extension.ts)): Registers commands, manages webviews, and acts as the entry point.
- **Git operations** ([src/gitOperations.ts](src/gitOperations.ts)): Centralized wrappers around native `git` execution commands.
- **Git parser** ([src/gitParser.ts](src/gitParser.ts)): Pure parsing logic for `git log` outputs. Should always be covered by unit tests (see [src/test/gitParser.test.ts](src/test/gitParser.test.ts)).
- **Webview UI** ([src/webview/](src/webview/)): React components bundled separately using `esbuild`.
- For more details on the setup and pull request process, reference [CONTRIBUTING.md](CONTRIBUTING.md).

## Build and Test
- **Package Manager**: `pnpm` (>= 10)
- **Install dependencies**: `pnpm install`
- **Build**: `pnpm run compile` (builds both extension using `tsc` and webview using `esbuild`)
- **Test**: `pnpm run test` (runs Vitest unit tests)
- **Watch mode**: `pnpm run watch` (extension source) and `pnpm run watch:webview` (webview source).

## Conventions
- **Minimalist Design**: Do not introduce UI bloat, tabs, or settings pages. The project adheres to a strict "less is more" philosophy.
- **Dependency Rule**: Do not introduce external runtime dependencies unless strictly necessary and justified.
