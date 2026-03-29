## 1. Hook Script

- [x] 1.1 Create `scripts/claude-session-hook.sh` that reads Claude Code hook JSON from stdin, extracts `session_id` and event type, writes state to `/tmp/claude-session-state-<sessionId>.json`
- [x] 1.2 Support 3 hook contexts: Notification events (extract `notification_type`), UserPromptSubmit (write "working"), Stop (write "idle")
- [x] 1.3 Test the hook script manually by piping JSON and verifying state file output

## 2. Backend — Rewrite Scanner for Hook-Based Detection

- [x] 2.1 Rewrite `server/claudeSessionScanner.js`: remove CPU-delta and network-connection heuristics, add hook state file reading (`/tmp/claude-session-state-<sessionId>.json`)
- [x] 2.2 Add hook configuration check: read `~/.claude/settings.json` on init, verify our hook script is present in Notification, UserPromptSubmit, and Stop hooks — set `hookConfigured` flag
- [x] 2.3 Add zombie detection: entrypoint-aware check for tmux client attachment (CLI/tmux), parent PID reparenting (CLI/regular terminal, VS Code extension)
- [x] 2.4 Add stale state file cleanup: delete `/tmp/claude-session-state-*.json` files that don't match any active session
- [x] 2.5 Update `GET /api/claude-sessions` response to include `hookConfigured` boolean alongside `sessions` array
- [x] 2.6 Add `POST /api/claude-sessions/kill` endpoint: validate PIDs are `claude` processes, send SIGTERM, return killed/failed arrays

## 3. Backend — Tests

- [x] 3.1 Write unit tests for hook state file reading: working/waiting/idle states, missing file defaults to idle, malformed file handling
- [x] 3.2 Write unit tests for zombie detection: tmux no-client, reparented parent, VS Code extension dead parent
- [x] 3.3 Write unit tests for hook configuration check: present/missing hooks in settings.json
- [x] 3.4 Write API tests for `/api/claude-sessions` with hookConfigured flag and `/api/claude-sessions/kill` endpoint

## 4. Frontend — Feature Gate & State Updates

- [x] 4.1 Update `src/hooks/useClaudeSessions.js`: parse `hookConfigured` from API response, expose it to consumers
- [x] 4.2 Update `src/components/Dashboard.js`: hide Claude column, summary panel, and filters when `hookConfigured === false`
- [x] 4.3 Update state names throughout frontend: "working", "waiting", "idle", "zombie" (replace old "active"/"idle" names)

## 5. Frontend — 4-State Claude Column

- [x] 5.1 Update `src/components/WorkspaceTable.js` Claude column: render separate badges for working (green pulse), waiting (amber pulse), idle (grey) — exclude zombies from column
- [x] 5.2 Update `src/components/WorkspaceTable.css`: add styles for 4 states — `.claude-dot-working` (green pulse), `.claude-dot-waiting` (amber pulse), `.claude-dot-idle` (grey)
- [x] 5.3 Update Claude column sorting: sort by urgency (waiting > working > idle > none)

## 6. Frontend — Summary Panel with Zombie Management

- [x] 6.1 Update `src/components/ClaudeSessionSummary.js`: show working/waiting/idle counts, hide when no sessions and no zombies
- [x] 6.2 Add zombie section to summary panel: list each zombie with workspace name, age (time since startedAt), PID, and individual "✕" kill button
- [x] 6.3 Add "Kill All" button when multiple zombies exist
- [x] 6.4 Wire kill buttons to `POST /api/claude-sessions/kill` with confirmation dialog before sending

## 7. Frontend — Notifications

- [x] 7.1 Update `src/hooks/useClaudeNotifications.js`: fire on `working → waiting` transition, 30s debounce per session

## 8. Tray Menu (Rust)

- [x] 8.1 Update `src-tauri/src/tray.rs`: use new state names (working/waiting/idle), show zombie count in summary line
- [x] 8.2 Update tray workspace annotations: ⚡ for working, ⏳ for waiting, no indicator for idle

## 9. Documentation

- [x] 9.1 Update README.md: document required hook configuration with copy-paste JSON, explain what each state means, add troubleshooting for "Claude integration not showing"

## 10. Integration Testing

- [x] 10.1 Update E2E tests: verify Claude column hidden when hookConfigured is false, visible when true
- [x] 10.2 Update E2E tests: verify 4 states render correctly with mock data
- [x] 10.3 Update E2E tests: verify zombie kill button sends correct API request
- [ ] 10.4 Manual verification: configure hooks, run Claude sessions, verify all 4 states appear correctly
