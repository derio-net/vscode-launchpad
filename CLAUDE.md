# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VS Code Launchpad — a desktop (Tauri) and web app for viewing/managing VS Code workspaces. React frontend + Express backend + Tauri/Rust desktop shell. The backend discovers workspaces from VS Code's `workspaceStorage/` directory and exposes them via REST API.

## Commands

### Development
```bash
npm install                # Install dependencies
npm run dev                # Run server (3010) + React dev (3020) concurrently
npm run tauri:dev          # Desktop development with hot reload
```

### Testing
```bash
npm test                   # Frontend unit tests (single run)
npm run test:watch         # Frontend tests in watch mode
npm run test:server        # Server/API tests
npm run test:server:watch  # Server tests in watch mode
npm run test:all           # Frontend + server tests
npm run test:e2e           # Playwright E2E tests (requires running servers)
npm run test:e2e:ui        # Playwright interactive UI mode
npm run test:coverage      # Frontend coverage report
```

Frontend tests use `react-scripts test` (Jest + Testing Library). Server tests use a separate config: `jest.server.config.js`. E2E tests use Playwright (`playwright.config.js`).

To run a single test file:
```bash
npx react-scripts test --watchAll=false --testPathPattern="App.test"     # single frontend test
npx jest --config jest.server.config.js --testPathPattern="api.test"     # single server test
npx playwright test e2e/dashboard.spec.js                                # single E2E test
```

### Building
```bash
npm run build              # Build React frontend → public/
npm run build:sidecar      # Bundle server as standalone binary via pkg
npm run tauri:build        # Build Tauri desktop app
npm run tauri:build:full   # Build sidecar + desktop app (full pipeline)
```

## Architecture

### Sidecar Pattern
The Express server is bundled as a standalone binary (via `pkg`) and launched by Tauri as a sidecar process. Tauri manages sidecar lifecycle: spawn, health-check (`GET /health`), and auto-restart (max 3 attempts per 60s window). In web/Docker mode the server runs directly via Node.

### Key Layers

| Layer | Location | Tech |
|-------|----------|------|
| Frontend | `src/` | React 18 (JSX, not TypeScript) |
| API Client | `src/api/client.js` | Dual-mode: Tauri invoke or fetch |
| Backend | `server/` | Express on port 3010 |
| Workspace Scanner | `server/workspaceScanner.js` | Platform-aware FS scanning |
| Desktop Shell | `src-tauri/src/` | Rust/Tauri 2.x |

### Dual-Mode API Client
`src/api/client.js` detects whether it's running inside Tauri or a browser and routes requests accordingly. Both paths hit the same Express endpoints. Includes retry logic with exponential backoff.

### Workspace Discovery
`server/workspaceScanner.js` auto-detects the VS Code storage path per platform (macOS/Windows/Linux). Override with `WORKSPACES_MOUNT_POINT` env var. Workspace types: local, ssh-remote, dev-container, attached-container, vscode-remote.

### Express API Endpoints
- `GET /health` — status + uptime
- `GET /api/workspaces` — list workspaces
- `POST /api/validate-path` / `POST /api/validate-paths` — check paths exist
- `POST /api/workspaces/delete` — delete workspace storage dirs

### Tauri Commands (Rust)
- `open_vscode(uri)` — launch VS Code with a workspace URI
- `get_diagnostics()` — sidecar health and path info

Sidecar path resolution differs between dev (relative to project root) and prod (relative to executable directory).

## Environment Variables
- `DASHBOARD_PORT` (default 3010) — backend port
- `DASHBOARD_DEV_PORT` (default 3020) — React dev port
- `WORKSPACES_MOUNT_POINT` — override VS Code workspace storage path
- `LOG_LEVEL` — debug/info/warn/error
- `HOST` — bind address (127.0.0.1 default; 0.0.0.0 in Docker)

## Test Mocking
Frontend tests mock all `@tauri-apps/*` modules via mappings in `package.json` → `src/__mocks__/`. Server tests mock `workspaceScanner` to avoid filesystem dependency.

## CI/CD
- **test.yml**: Runs on push/PR to main/develop. Unit tests always run; E2E tests run on PRs only (builds frontend, starts servers, runs Playwright with Chromium).
- **release.yml**: Triggered by version tags (`v*`). Builds sidecar binaries for 4 platforms, then builds Tauri desktop apps with code signing (macOS/Windows), creates draft GitHub release.

## Development Methodology — OpenSpec

This project uses the **OpenSpec** plugin for structured, spec-driven development. All feature work follows a defined artifact workflow.

### Workflow

Use the `/opsx:*` slash commands (or equivalent `openspec-*` skills) to drive development:

1. **`/opsx:new`** — Start a new change (creates a change directory under `openspec/changes/`)
2. **`/opsx:continue`** — Create the next artifact in sequence: proposal → design → delta specs → tasks
3. **`/opsx:ff`** — Fast-forward: generate all artifacts through tasks in one pass
4. **`/opsx:apply`** — Implement tasks from the change's `tasks.md`
5. **`/opsx:verify`** — Verify implementation matches the change artifacts
6. **`/opsx:archive`** — Archive a completed change (moves to `openspec/changes/archive/`)
7. **`/opsx:explore`** — Thinking/exploration mode — no implementation, just investigation
8. **`/opsx:sync`** — Sync delta specs from a change into `openspec/specs/`

### Directory Structure

```
openspec/
├── specs/           # 20 main capability specifications (the living documentation)
│   └── <capability>/
│       └── spec.md
└── changes/
    ├── <active-change>/     # In-progress changes
    │   ├── .openspec.yaml   # Metadata (schema: spec-driven)
    │   ├── proposal.md      # Why this change exists
    │   ├── design.md        # Design decisions
    │   ├── specs/           # Delta specs (modifications to main specs)
    │   └── tasks.md         # Implementation checklist
    └── archive/             # Completed changes (15 archived)
```

### Key Concepts

- **Specs** (`openspec/specs/`) are the source of truth for what the system does. Each capability has a `spec.md` using scenario-based WHEN/THEN format.
- **Changes** are the unit of work. Each change produces artifacts (proposal, design, delta specs, tasks) before implementation begins.
- **Delta specs** capture how a change modifies existing capabilities. They get synced to main specs via `/opsx:sync`.
- **Artifact sequence is strict**: proposal → design → specs → tasks → apply → verify → archive. Use `/opsx:continue` to advance one step at a time.
