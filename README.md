# VS Code Launchpad

[![Tests](https://github.com/derio-net/vscode-launchpad/actions/workflows/test.yml/badge.svg)](https://github.com/derio-net/vscode-launchpad/actions/workflows/test.yml)
[![Playwright](https://img.shields.io/badge/tested%20with-Playwright-45ba4b.svg?logo=playwright)](https://playwright.dev)

View, search, and open all your VS Code workspaces from one place. A cross-platform web dashboard (and future desktop app) that reads workspace metadata from VS Code's storage directory and presents it in a clean, searchable interface.

![VS Code Launchpad Screenshot](screenshot.jpeg)

## Features

- 🔍 **Search & Filter** — Find workspaces by name, path, or type
- 📊 **Sort** — Sort by name, path, type, or last modified date
- 🚀 **Quick Open** — Click any workspace to open it directly in VS Code
- 🔄 **Auto-Refresh** — Detects new workspaces every 30 seconds
- 💡 **Path Tooltips** — Hover over workspace names to see the full file path
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

Build the full application from source for your current platform:

```bash
npm run tauri:build:full
```

Then install the built application:

- **macOS**: Drag the `.app` from `src-tauri/target/release/bundle/macos/` into your Applications folder, or open the `.dmg`. Downloaded builds are not notarized, so macOS will block them. Remove the quarantine flag first: `/usr/bin/xattr -cr "/Applications/VS Code Launchpad.app"`
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

LaunchPad can show live Claude Code session status per workspace — which sessions are working, waiting for approval, idle, or orphaned (zombie). This requires configuring Claude Code hooks.

**Without hooks configured, the Claude integration does not appear in the UI.**

### Setup

**Automatic (recommended):**

```bash
./scripts/install-claude-hooks.sh          # Install hooks
./scripts/install-claude-hooks.sh --check  # Verify installation
./scripts/install-claude-hooks.sh --remove # Uninstall hooks
```

The script backs up your settings before modifying them, is idempotent, and only adds/removes LaunchPad hooks.

**Manual:** Add the following to your `~/.claude/settings.json` (adjust the path to where you installed LaunchPad):

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt|idle_prompt",
        "hooks": [{ "type": "command", "command": "/path/to/vscode-launchpad/scripts/claude-session-hook.sh" }]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "/path/to/vscode-launchpad/scripts/claude-session-hook.sh working" }]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "/path/to/vscode-launchpad/scripts/claude-session-hook.sh idle" }]
      }
    ]
  }
}
```

### Session States

| State | Indicator | Meaning |
|-------|-----------|---------|
| **Working** | Green (pulsing) | Claude is actively streaming/computing |
| **Waiting** | Amber (pulsing) | Claude needs tool approval from you |
| **Idle** | Grey | Claude is at the prompt, nothing pending |
| **Zombie** | Red (in summary) | Terminal disconnected, session orphaned — can be killed from the UI |

### Troubleshooting

- **"Claude integration not showing"** — Check that `~/.claude/settings.json` contains the hooks above and that the script path is correct. New Claude sessions must be started after adding hooks.
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
