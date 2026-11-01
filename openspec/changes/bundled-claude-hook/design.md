## Context

Claude session status relies on three Claude Code hooks (Notification, UserPromptSubmit, Stop) that run a small script. The script writes a per-session state file, and `server/claudeSessionScanner.js` polls those files. Today:

- The script lives only in the repo (`scripts/claude-session-hook.sh`). It is installed by `scripts/install-claude-hooks.sh`, which writes the **checkout's absolute path** into `~/.claude/settings.json`. The desktop bundle (`src-tauri/tauri.conf.json`) ships only `binaries/sidecar-vscode-dashboard`, so Release users cannot enable the feature. Moving the clone breaks every Claude session machine-wide (PR #7 makes re-running the installer repair this, but it still needs a clone).
- The script requires `bash` and `jq`.
- The hook writes `/tmp/claude-session-state-<id>.json`, while the scanner reads `os.tmpdir()`. On macOS that is `$TMPDIR` (`/var/folders/…/T`), so the files are never found and every session reads `idle`. Stale-file cleanup also scans the wrong directory, so `/tmp` files are never cleaned up.
- The server runs in three modes: Tauri sidecar (pkg binary, `HOST=127.0.0.1`), web/dev (`node server/index.js`), and Docker (`HOST=0.0.0.0`, container home directory).

## Goals / Non-Goals

**Goals:**
- Enable, repair and disable Claude status from the app, with no clone, no terminal and no `jq`.
- Make the hook path independent of where the repo or app lives, and keep it stable across app updates and moves.
- Fix the macOS state-directory mismatch.
- Keep one installer implementation, shared by the UI, the API and the CLI script.
- Never break a user's other hooks or settings.

**Non-Goals:**
- Windows support for the hook (status reports `unsupported`, see Open Questions).
- Installing hooks inside Docker (the container's `~/.claude` is not the user's).
- Auto-enabling hooks without explicit user action.
- Changing how sessions themselves are discovered (`~/.claude/sessions/`) or how zombies are detected.

## Decisions

### D1. The hook script is embedded in the server and written to `~/.claude/vscode-launchpad/hook.sh`
The script text lives in a JS module (`server/claudeHook/hookScript.js`) that exports a string and a content hash. `pkg` bundles JS reliably, while asset globs are easy to get wrong. On install, the server writes it to `~/.claude/vscode-launchpad/hook.sh` (mode `0755`).

*Alternatives:*
- **Hook calls the sidecar binary** (`sidecar --claude-hook idle`): no script file, but the bundle path moves with the app (AppImage paths change on every run, users drag `.app` bundles around), and every prompt and stop would pay pkg/Node startup cost (about 150–300 ms).
- **Point at a script inside the app bundle**: same path instability, and macOS app translocation makes the path unpredictable.
- **`~/.claude/hooks/`**: plausible, but a dedicated `vscode-launchpad/` folder keeps the script and its state together and is trivial to remove.

### D2. The hook is POSIX `sh` and uses no `jq`
The scanner reads only `type` from state files (`readSessionState`), so the hook needs just `session_id` (a UUID) and `notification_type` (an enum). Both are extracted with `sed` patterns anchored on their JSON keys. `cwd` is dropped from the state file because nothing reads it, and parsing arbitrary escaped strings without `jq` is where shell JSON handling goes wrong. `session_id` must match `^[A-Za-z0-9_-]+$` before it is used in a filename (no path traversal); otherwise the hook exits 0. The hook **always exits 0**: a broken status feature must never surface as a Claude Code hook error.

### D3. State moves to `~/.claude/vscode-launchpad/state/<sessionId>.json`
This is one explicit directory that both sides compute from `$HOME`, independent of `TMPDIR` (which differs between launchd, tmux and container environments). It is not wiped on reboot, but the scanner's existing stale-file cleanup now runs on the right directory and removes files for sessions that no longer exist. Files are written atomically (temp file in the same dir + `mv`).
*Alternatives:* hard-code `/tmp` on both sides (shared on one machine, but leaves cleanup and ownership in a world-writable directory); `os.tmpdir()` on both sides (the hook can't reliably match it).

### D4. One installer in JS: `server/claudeHookInstaller.js`
It exports `getStatus()`, `install()`, `remove()` and `refreshScript()`, and has a CLI entry point (`node server/claudeHookInstaller.js status|install|remove`). `scripts/install-claude-hooks.sh` becomes a few lines that `exec` that CLI, keeping its `--check` / `--remove` flags. PR #7's bash and jq logic is retired, but its behaviour (replace stale entries, keep unrelated ones, idempotent) is carried over and covered by tests.

### D5. How LaunchPad hook entries are recognised and written
- A command is LaunchPad's if it contains `vscode-launchpad/hook.sh` (current) or `claude-session-hook.sh` (legacy, any path).
- Written commands use the **absolute** path, double-quoted, plus an argument: `"/Users/x/.claude/vscode-launchpad/hook.sh" working`. An absolute path keeps status checks deterministic. `$HOME/...` would make the settings file portable across machines, but the status check would then need to reproduce shell expansion. Rejected for now.
- Install is "strip all LaunchPad entries, then append the three canonical ones", so it doubles as repair and migration. Matchers: Notification `permission_prompt|idle_prompt`, the other two `""` (unchanged from today).

### D6. Status model
`getStatus()` returns `{ status, scriptPath, events: {Notification, UserPromptSubmit, Stop}, legacy: boolean, reason? }`, where `status` is one of:
- `installed`: all three events have a current entry, the script exists, and there are no legacy entries.
- `needs-repair`: any LaunchPad entry exists but the result is not `installed` (a legacy entry, a missing script, or only some events hooked).
- `not-installed`: no LaunchPad entries.
- `unsupported`: Windows, or running in a container (`/.dockerenv` or `/run/.containerenv`).

The scanner's `hookConfigured` becomes `status === 'installed'`. A `needs-repair` install is not "configured": the feature stays hidden and the repair banner shows instead.

### D7. Safe edits to `settings.json`
Read → parse (if invalid JSON, **refuse** and report rather than overwrite) → copy to `settings.json.launchpad.bak` → modify → write a temp file in the same directory → `rename`. `settings.json` can hold secrets (`env` API keys), so the backup and temp file are created with the original file's mode (`0600` for a new file), exclusively (`wx`, after unlinking any stale file) so a planted symlink is never followed. Only `hooks.Notification` / `UserPromptSubmit` / `Stop` are touched; empty arrays and an empty `hooks` object are removed on uninstall. The output is formatted with 2-space indentation, which matches what Claude Code writes.

### D8. Script refresh on startup
When the server starts with status `installed` or `needs-repair` and the on-disk `hook.sh` hash differs from the embedded one, it rewrites `hook.sh`. It never touches `settings.json` on startup. App updates therefore carry hook fixes, while enabling stays opt-in.

### D9. API
- `GET /api/claude-hooks` → status object (D6).
- `POST /api/claude-hooks/install` → `{ status }` after install (also used for repair).
- `POST /api/claude-hooks/remove` → `{ status }`.

Both POSTs are guarded three ways, so a random web page cannot change the user's Claude config through `localhost:3010`:
- `403` unless the `Host` header is a loopback name (`localhost`, `127.0.0.1`, `[::1]`, `tauri.localhost`). This defeats **DNS rebinding**, where an attacker's hostname resolves to 127.0.0.1 and its requests become same-origin, so no CORS preflight ever happens.
- `403` if an `Origin` header is present and not on the CORS allowlist.
- `415` unless `Content-Type` is `application/json`, which forces a preflight for any cross-origin caller.

Both return `409` with the reason when status is `unsupported`, and `422` when `settings.json` is invalid. The existing `/api/workspaces/delete` and `/api/claude-sessions/kill` endpoints lack the Host/Origin guard; that is tracked as a follow-up, out of scope here.

### D10. UI
- The dashboard header gets a **Claude Code status** control (button + small menu): *Enable* when `not-installed`, *Repair* when `needs-repair`, *Disable* when `installed`. It is hidden when `unsupported`.
- When status is `needs-repair`, a dismissible banner above the table says the hooks point at a missing script, warns that Claude Code shows a hook error on every turn until fixed, and offers **Repair**. Dismissal is stored per viewer in `localStorage` and shows again if the status later changes.
- After install or remove, the client refetches `/api/claude-sessions`. The existing "detected after initial render" logic then reveals the Claude column without a reload.
- No banner is shown for `not-installed`: the feature is opt-in and should not nag.

## Risks / Trade-offs

- **Claude Code writes `settings.json` at the same moment** (e.g. `/config`) → lost update. Mitigation: read-modify-rename within milliseconds and only on explicit user action. The backup is kept.
- **Reformatting `settings.json`** (key order is kept, whitespace normalised) → noisy diffs for users who version their dotfiles. Accepted; noted in the README.
- **`sed`-based extraction breaks if Claude changes the hook JSON shape** → the hook exits 0 with no state, so sessions fall back to `idle`; no user-visible error. Covered by a test that feeds sample payloads.
- **State dir no longer auto-cleared on reboot** → bounded by stale cleanup (one small file per dead session, removed on the next scan).
- **Users with a dotfiles-synced `settings.json`** get an absolute path containing their username → it already works that way today; D5 notes `$HOME` as a possible later change.
- **Users still running from a clone keep legacy entries** → status `needs-repair` and the banner, or `install-claude-hooks.sh` (which now migrates).

## Migration Plan

1. Ship the server, UI and wrapper script together.
2. Existing users with legacy `claude-session-hook.sh` entries see the **Repair** banner. One click replaces them with the new entries and writes `hook.sh`.
3. Old `/tmp/claude-session-state-*.json` files are left alone (harmless, cleared on reboot).
4. Rollback: **Disable** in the UI, or `node server/claudeHookInstaller.js remove`, or restore `settings.json.launchpad.bak`. An older app version's installer still recognises entries by `claude-session-hook.sh` only, so after a downgrade users should run Disable before downgrading. This goes in the release notes.

## Open Questions

- **Windows:** does Claude Code on Windows run hook commands through a POSIX shell (Git Bash) reliably enough to support `hook.sh`? Until verified, status is `unsupported` on Windows and the control is hidden.
- **Use `$HOME` in hook commands** (D5) to make synced dotfiles portable? Deferred until someone asks for it.
