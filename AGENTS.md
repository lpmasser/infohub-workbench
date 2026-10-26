# InfoHub 工程入口

Maintainers use InfoHub for project context. Its location is recorded in `~/.config/infohub/config.json` (under the user profile on Windows). Run `infohub brief ontology-doc`, then read the workbench implementation notes and applicable standards. If the workspace is unavailable, ask the maintainer for relevant context; no private server address is assumed. Use GitHub for source, checks and releases.

For adding/updating any feature, always refer to the decision tree in the docs/architecture.md file FIRST and adhere to it RELIGIOUSLY.

## Post edit tasks

- For major features, code-changes, invoke a subagent (code-simplifier subagent/skill) with full context to simplify WITHOUT breaking the logic or the "requirements" that user proposed. Simplification will be penalized if it breaks existing code patterns, standards or guidelines
- When you have made **code changes** run the following and fix any issues:
  - `pnpm check` — Svelte/TypeScript type checking
  - `pnpm lint` — oxlint linting
  - `pnpm test` — Vitest unit/integration tests
  - `cd src-tauri && cargo check` — Rust type checking (run from `src-tauri/` directory)
  - `pnpm format` — Prettier (writes formatting)

## Project-specific guidelines

- Prefer snake case for file names
- Don't assume library usage; review before using
- For UI, always use shadcn semantic utilities. Use custom utilities only when shadcn lacks the specific token

## Web automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes
