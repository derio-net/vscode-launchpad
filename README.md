# VS Code Launchpad

[![Tests](https://github.com/derio-net/vscode-launchpad/actions/workflows/test.yml/badge.svg)](https://github.com/derio-net/vscode-launchpad/actions/workflows/test.yml)
[![Latest Release](https://img.shields.io/github/v/release/derio-net/vscode-launchpad)](https://github.com/derio-net/vscode-launchpad/releases/latest)
[![Playwright](https://img.shields.io/badge/tested%20with-Playwright-45ba4b.svg?logo=playwright)](https://playwright.dev)

View, search, and open all your VS Code workspaces from one place. A cross-platform web dashboard and Tauri desktop app that reads workspace metadata from VS Code's storage directory and presents it in a clean, searchable interface.

![VS Code Launchpad Screenshot](screenshot.jpeg)

## Features

- 🔍 **Search & Filter** — Find workspaces by name, path, or type
- 📊 **Sort** — Sort by name, path, type, or last modified date
- 🚀 **Quick Open** — Click any workspace to open it directly in VS Code
- 🔄 **Auto-Refresh** — Detects new workspaces every 30 seconds
- 💡 **Path Tooltips** — Hover over workspace names to see the full file path
- 📐 **Customizable Columns** — Resize, drag-to-reorder, and toggle visibility via the right-click header menu
- 🐳 **Docker Support** — Deploy easily with Docker and docker-compose
- 💻 **Desktop App** — Native app using Tauri (macOS, Windows, Linux)
- 🔒 **Secure** — Runs only on localhost by default
- 🤖 **Claude Session Monitor** — See which workspaces have active Claude Code sessions, their state (working/waiting/idle), and kill orphaned zombie sessions

**Supported workspace types:** Local, Remote, SSH Remote, Dev Container, Attached Container.

## Quick Start

### Dev Container (Recommended)

Open in [GitHub Codespaces](https://github.com/codespaces) or any editor with [Dev Containers](https://containers.dev/) support. Everything is pre-configured — just run `npm run dev`.

### Local

```bash
git clone https://github.com/derio-net/vscode-launchpad.git
cd vscode-launchpad
npm install
npm start
```

Open http://localhost:3010 in your browser.

### Docker

```bash
cp .env.example .env
# Edit .env and set WORKSPACES_MOUNT_POINT to your VS Code workspace storage directory
docker-compose up -d
```

See [docs/DOCKER.md](docs/DOCKER.md) for detailed Docker deployment instructions.

### Desktop App

Download the installer for your platform from the [latest release](https://github.com/derio-net/vscode-launchpad/releases/latest):

- **macOS**: Open the `.dmg` and drag the app into your Applications folder. Builds are not notarized, so macOS will quarantine them — clear the flag first: `/usr/bin/xattr -cr "/Applications/VS Code Launchpad.app"`
- **Windows**: Run the `.msi` installer (or the `-setup.exe`)
- **Linux**: Run the `.AppImage`, or install the `.deb` / `.rpm`

#### Build from source

Build the full application for your current platform:

```bash
npm run tauri:build:full
```

Then install the built application:

- **macOS**: Drag the `.app` from `src-tauri/target/release/bundle/macos/` into your Applications folder, or open the `.dmg` (locally built apps carry no quarantine flag)
- **Windows**: Run the `.msi` installer from `src-tauri/target/release/bundle/msi/`
- **Linux**: Run the `.AppImage` or install the `.deb` from `src-tauri/target/release/bundle/`

Cross-platform builds for all platforms run automatically via [GitHub Actions](.github/workflows/release.yml) when a version tag is pushed. See [BUILD.md](BUILD.md) for full build instructions and prerequisites (Rust, platform-specific dependencies).

## How It Works

The dashboard reads workspace metadata from platform-specific VS Code storage locations:

- **macOS**: `~/Library/Application Support/Code/User/workspaceStorage/`
- **Windows**: `%APPDATA%\Code\User\workspaceStorage\`
- **Linux**: `~/.config/Code/User/workspaceStorage/` (or `$XDG_CONFIG_HOME`)

Each workspace directory contains a `workspace.json` file. The dashboard scans these on startup, caches the data in memory, refreshes every 30 seconds, and serves it via a REST API to a React frontend.

## API

### GET /api/workspaces

Returns all discovered workspaces:

```json
[
  {
    "id": "workspace-id",
    "name": "My Project",
    "path": "file:///Users/username/projects/my-project",
    "type": "local",
    "lastModified": "2024-01-15T10:30:00.000Z",
    "storageDir": "/path/to/storage/dir"
  }
]
```

Additional endpoints: `GET /health`, `POST /api/validate-path`, `POST /api/validate-paths`, `POST /api/workspaces/delete`.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `DASHBOARD_PORT` | `3010` | Backend server port |
| `DASHBOARD_DEV_PORT` | `3020` | React dev server port |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` in Docker) |
| `WORKSPACES_MOUNT_POINT` | *(auto-detected)* | Override VS Code workspace storage path |
| `LOG_LEVEL` | `info` | Logging level (debug/info/warn/error) |

## Claude Code Integration

LaunchPad can show live Claude Code session status per workspace — which sessions are working, waiting for approval, idle, or orphaned (zombie). It works through three small Claude Code hooks that LaunchPad installs for you.

**Until the hooks are enabled, the Claude column and summary do not appear.**

### Setup

**Desktop app:** click **Enable Claude Code status** in the dashboard header. That's it — no checkout, terminal, or `jq` needed. The same button turns into **Disable Claude Code status** once enabled.

**Web / dev (from a checkout):**

```bash
./scripts/install-claude-hooks.sh          # Install (or repair) hooks
./scripts/install-claude-hooks.sh --check  # Exit 0 only if fully installed
./scripts/install-claude-hooks.sh --remove # Remove LaunchPad hooks
```

Both use the same installer (`server/claudeHookInstaller.js`, Node only). What it does:

- Writes the hook script to `~/.claude/vscode-launchpad/hook.sh` (a POSIX `sh` script, no dependencies). Its path doesn't depend on where LaunchPad or this repo lives, so moving or deleting a checkout no longer breaks your Claude sessions.
- Adds one entry each for the `Notification`, `UserPromptSubmit` and `Stop` hooks in `~/.claude/settings.json`, keeping all your other settings and hooks. The previous file is saved as `settings.json.launchpad.bak` with the same permissions; `settings.json` is rewritten with 2-space indentation.
- Records session state in `~/.claude/vscode-launchpad/state/`; files for ended sessions are cleaned up automatically.
- On each start, LaunchPad refreshes `hook.sh` if a newer version shipped. It never adds hooks you didn't enable.

**Repair:** if the hooks point at a missing or outdated script — for example an older install that referenced `scripts/claude-session-hook.sh` in a checkout — the dashboard shows a banner with a **Repair** button (or run the script above). If that checkout has since moved or been deleted, Claude Code prints a hook error on every turn until you repair. If it's still there, `scripts/claude-session-hook.sh` now forwards to the bundled hook, so nothing breaks in the meantime.

**Not supported yet:** Windows, and running LaunchPad inside Docker (the container's `~/.claude` isn't the one your Claude sessions use). The control is hidden there.

**Downgrading** to a version older than this feature? Click **Disable Claude Code status** first; older versions don't recognise the new hook entries.

### Session States

| State | Indicator | Meaning |
|-------|-----------|---------|
| **Working** | Green (pulsing) | Claude is actively streaming/computing |
| **Waiting** | Amber (pulsing) | Claude needs tool approval from you |
| **Idle** | Grey | Claude is at the prompt, nothing pending |
| **Zombie** | Red (in summary) | Terminal disconnected, session orphaned — can be killed from the UI |

### Sessions outside your workspaces

A session appears on a workspace row when its folder is that workspace or sits inside it. Sessions started in folders VS Code doesn't list as workspaces (say, a repo you only ever use from the terminal) are shown in the summary panel under **Other sessions**, grouped by folder. Click **Open in VS Code** on one: VS Code opens the folder and adds it to its workspace list, and after the next refresh it has its own row with the session indicators.

### Troubleshooting

- **"Claude integration not showing"** — Run `./scripts/install-claude-hooks.sh --check` (or look for the Enable/Repair button) to see the hook status and why. Claude sessions started before enabling must be restarted.
- **"Sessions show wrong state"** — State updates happen on Claude Code events. If you just configured hooks, restart your Claude sessions.
- **"Zombie sessions won't die"** — Use the Kill button in the summary panel, or manually: `kill <PID>`.

## Documentation

| Document | Description |
|---|---|
| [BUILD.md](BUILD.md) | Building from source (desktop + web) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
| [docs/DOCKER.md](docs/DOCKER.md) | Docker deployment guide |
| [docs/TESTING.md](docs/TESTING.md) | Test suite details |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and fixes |

## Requirements

- **Node.js** 18 or higher
- **Cross-platform**: macOS, Windows, Linux
- **VS Code** installed with at least one workspace opened

## License

MIT

## Contributing

Contributions are welcome! This project uses the [OpenSpec (OPSX) workflow](CONTRIBUTING.md#development-workflow--openspec) for all feature work. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.
