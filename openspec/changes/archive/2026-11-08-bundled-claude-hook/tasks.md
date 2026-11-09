## 1. Bundled hook script

- [x] 1.1 Create `server/claudeHook/paths.js` exporting `launchpadDir()` (`~/.claude/vscode-launchpad`), `hookScriptPath()`, `stateDir()`, `stateFilePath(sessionId)`, plus the markers `CURRENT_MARKER = 'vscode-launchpad/hook.sh'` and `LEGACY_MARKER = 'claude-session-hook.sh'`
- [x] 1.2 Write failing tests in `server/__tests__/claudeHookScript.test.js`: run the embedded script under `/bin/sh` with a temp `HOME` and sample payloads covering `working`/`idle` args, `permission_prompt`→`waiting`, `idle_prompt`→`idle`, a missing `session_id`, an unsafe `session_id` (`../x`), and an unwritable state dir (all exit 0, correct or absent file)
- [x] 1.3 Create `server/claudeHook/hookScript.js` exporting `HOOK_SCRIPT` (POSIX sh, no jq, `sed` extraction, session-id allowlist, atomic write, always `exit 0`) and `HOOK_SCRIPT_HASH` (sha256); make 1.2 pass
- [x] 1.4 Confirm `pkg` bundles the module: `npm run build:sidecar`, then check that the binary serves `GET /api/claude-hooks` (after group 3)

## 2. Installer core

- [x] 2.1 Write failing tests in `server/__tests__/claudeHookInstaller.test.js` against a temp `HOME`: status for not-installed / installed / legacy / script-missing / partial / missing settings file; unsupported on `win32` and on container markers (inject platform and `fs` checks)
- [x] 2.2 Implement `getStatus()` in `server/claudeHookInstaller.js` per design D6
- [x] 2.3 Write failing tests: fresh install; repair of legacy `/old/checkout/...` entries; unrelated hooks and top-level keys preserved; idempotent (byte-identical second run); backup written to `settings.json.launchpad.bak`; invalid JSON refused, file untouched; missing `~/.claude` created
- [x] 2.4 Implement `install()`: write `hook.sh` 0755, strip all LaunchPad entries, append the 3 canonical quoted-absolute-path entries, back up, write atomically (temp + rename)
- [x] 2.5 Write failing tests for `remove()` (only LaunchPad entries removed, empty arrays and `hooks` deleted, launchpad dir removed) and `refreshScript()` (rewrites an outdated script only when LaunchPad entries exist; no-op when not installed; never touches `settings.json`)
- [x] 2.6 Implement `remove()` and `refreshScript()`
- [x] 2.7 Add a CLI entry point (`require.main === module`): `status|install|remove`, human-readable output, exit codes (`status` exits 0 only when `installed`)

## 3. API

- [x] 3.1 Write failing tests in `server/__tests__/api.test.js` (installer mocked): `GET /api/claude-hooks`; `POST /install` and `/remove` return the new status; `415` for non-JSON content type; `409` when unsupported; `500` with a message when the installer throws
- [x] 3.2 Add the three routes to `server/index.js` and list them in the startup log
- [x] 3.3 Call `refreshScript()` during server startup (next to `claudeSessionScanner.initialize()`), logging and swallowing errors

## 4. Session scanner

- [x] 4.1 Update `server/__tests__/claudeSessionScanner.test.js`: state read from `stateFilePath(id)`; stale cleanup scans `stateDir()` and tolerates it missing; `checkHookConfigured` returns true only when the installer status is `installed` (mock the installer)
- [x] 4.2 In `server/claudeSessionScanner.js` replace `STATE_DIR = os.tmpdir()` and the `claude-session-state-` prefix with `claudeHook/paths`; delegate `checkHookConfigured` to `getStatus()`; drop the now-unused `HOOK_SCRIPT_NAME` export (update its references)

## 5. Frontend

- [x] 5.1 Add `getClaudeHooks()`, `installClaudeHooks()`, `removeClaudeHooks()` to `src/api/client.js` (POSTs send `Content-Type: application/json`), with tests covering both the Tauri and fetch paths
- [x] 5.2 Create `src/hooks/useClaudeHookStatus.js` (fetch on mount, `install`/`remove` actions, error state, then trigger a refetch of `useClaudeSessions`), with tests
- [x] 5.3 Create `src/components/ClaudeHookControl.js`: Enable / Repair / Disable per status, a confirmation before Disable (Tauri confirmation dialog in desktop mode, matching the existing pattern), error display, hidden when `unsupported`; with tests for each status
- [x] 5.4 Create `src/components/ClaudeHookRepairBanner.js`: shown only for `needs-repair`, Repair button, dismissal in `localStorage` keyed by status (wrapped in try/catch); with tests
- [x] 5.5 Wire both into `src/components/Dashboard.js` (control in the header, banner above the table) using the existing design tokens; confirm that installing reveals the Claude column without a reload
- [x] 5.6 Add a Playwright test in `e2e/` with the API mocked to `not-installed` → Enable → column visible

## 6. CLI script, docs, cleanup

- [x] 6.1 Rewrite `scripts/install-claude-hooks.sh` as a thin wrapper: `--check`→`status`, `--remove`→`remove`, default→`install`, running `node "$REPO/server/claudeHookInstaller.js"`; remove the `jq` requirement; port PR #7's `installClaudeHooks.test.js` cases to the wrapper
- [x] 6.2 Replace `scripts/claude-session-hook.sh` with a compatibility shim that forwards to `~/.claude/vscode-launchpad/hook.sh` when installed and otherwise exits 0 silently (legacy installs point at it; deleting it would bring back the per-turn hook error), with tests
- [x] 6.3 Update README "Claude Code session status": desktop → click **Enable Claude Code status**; web/dev → `./scripts/install-claude-hooks.sh`; note the state/script location, the `settings.json.launchpad.bak` backup, Windows/Docker unsupported, and "Disable before downgrading"
- [x] 6.4 Update `CLAUDE.md` Express API endpoints list with `/api/claude-hooks*`

## 7. Verification

- [x] 7.1 `npm run test:all` green; `npm run test:e2e` green
- [x] 7.2 Manual check on macOS with a real Claude Code session: starting from legacy entries the banner appears → Repair → submit a prompt → the dashboard shows `working`, then `idle` after the turn ends, with no hook error printed by Claude Code — verified 2026-11-01: real legacy install read `needs-repair` → Repair via API → `installed` (other hooks/settings unchanged, 0600 kept); a real Claude Code run wrote state ending `idle` with empty stderr; an interactive session showed `working` on `/api/claude-sessions`
- [x] 7.3 Manual check of the desktop build (`npm run tauri:build:full`) from `/Applications` with no repo on `PATH`: Enable works, and Disable restores `settings.json` to have no LaunchPad entries — verified 2026-11-01 by the operator with the published v0.3.0 DMG installed in `/Applications`: Disable and Enable both worked in the app. The settings.json contents after Disable were not inspected separately (covered by installer tests)
