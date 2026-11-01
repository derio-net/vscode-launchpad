## Why

Claude session status only works when a user runs `scripts/install-claude-hooks.sh` from a git checkout. The installer writes that checkout's absolute script path into the global `~/.claude/settings.json`, so moving or deleting the clone breaks **every** Claude Code session on the machine (`Stop hook error: … claude-session-hook.sh: No such file or directory`). Users who install the desktop app from GitHub Releases cannot enable the feature at all, because the app bundle ships only the sidecar binary.

Separately, on macOS the hook writes state to `/tmp`, but the scanner reads `os.tmpdir()` (`/var/folders/…/T`). It never finds the state files, so every session shows as `idle`.

## What Changes

- The hook script ships **inside the server** (sidecar binary and web server alike) and is written to a stable, app-owned location: `~/.claude/vscode-launchpad/hook.sh`. It no longer depends on where the repo or app lives.
- The hook no longer needs `jq`. It extracts the two fields it uses (`session_id`, `notification_type`) with POSIX shell, so it works on a stock macOS/Linux machine.
- Hook state moves to a single explicit directory, `~/.claude/vscode-launchpad/state/`, used by both the hook and the scanner. This fixes the macOS state mismatch. **BREAKING** (internal): `/tmp/claude-session-state-*.json` is no longer read.
- New server-side hook installer with **status**, **install** (also repairs) and **remove**:
  - Status reports one of `installed`, `not-installed`, `needs-repair` (hooks point at a missing or legacy script, or only some events are hooked), or `unsupported` (Windows).
  - Install adds the three hook entries, replaces legacy `claude-session-hook.sh` entries from any path, keeps unrelated user hooks, and backs up `settings.json` first.
  - Remove deletes only LaunchPad's entries.
- New REST endpoints `GET /api/claude-hooks`, `POST /api/claude-hooks/install` and `POST /api/claude-hooks/remove`.
- New dashboard control to enable, repair or disable Claude Code status. When an install needs repair (the case that breaks every session), a banner offers a one-click **Repair**.
- On startup, if LaunchPad hooks are installed, the server refreshes `hook.sh` when its content differs from the bundled version, so app updates carry hook fixes. It never adds hooks the user didn't enable.
- `hookConfigured` now means "status is `installed`": all three events hooked and the hook script present.
- `scripts/install-claude-hooks.sh` becomes a thin wrapper around the same server-side installer (one implementation, no `jq`), for the web/dev and Docker workflows.

## Capabilities

### New Capabilities
- `claude-hook-installer`: bundling, installing, repairing, refreshing and removing the Claude Code hook, plus its status and API.

### Modified Capabilities
- `claude-session-detection`: state files move to `~/.claude/vscode-launchpad/state/`; the hook-configuration gate requires the hook script to exist, not just a name match in `settings.json`.
- `claude-session-dashboard`: while hooks are not installed the Claude UI stays hidden, but an enable/repair control is offered, along with a repair banner when status is `needs-repair`.

## Impact

- **Server:** new `server/claudeHookInstaller.js` and embedded hook script module; `server/claudeSessionScanner.js` (state dir, gate); `server/index.js` (3 routes, startup refresh).
- **Frontend:** `src/api/client.js` (3 calls), `src/hooks/useClaudeSessions.js`, `src/components/Dashboard.js`, plus a new enable/repair control and banner.
- **Scripts:** `scripts/install-claude-hooks.sh` (wrapper); `scripts/claude-session-hook.sh` is removed, its content now living in the server module.
- **Docs:** README setup section becomes "click Enable in the app"; the script remains for web/Docker.
- **User machine:** writes `~/.claude/vscode-launchpad/` and edits `~/.claude/settings.json`, only on explicit user action.
- **Security:** the new POST endpoints change user config. They are bound to the existing CORS allowlist and require `Content-Type: application/json`, so cross-site simple requests can't trigger them.
- **Dependencies:** none added; `jq` is no longer required.
