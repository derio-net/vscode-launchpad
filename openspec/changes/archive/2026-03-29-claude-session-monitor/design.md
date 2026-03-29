## Context

LaunchPad already discovers and displays VS Code workspaces from `~/Library/Application Support/Code/User/workspaceStorage/`. Users running Claude Code in multiple VS Code terminal windows lose track of which sessions are active and which need attention.

Claude Code persists session metadata at `~/.claude/sessions/<pid>.json` for each running session. Each file contains:
```json
{
  "pid": 52707,
  "sessionId": "769f660e-...",
  "cwd": "/Users/.../vscode-launchpad",
  "startedAt": 1774728030542,
  "kind": "interactive",
  "entrypoint": "cli"          // or "claude-vscode"
}
```

During initial implementation, we tried CPU-time delta and network-connection heuristics to detect session state. Both proved unreliable:
- **CPU delta**: Background hooks/statusline consume ~60ms/5s, making idle sessions appear active
- **Network connections**: Keep-alive connections blur the streaming vs idle boundary

Claude Code has a built-in **hook system** with `Notification` events that fire on `permission_prompt` (tool approval needed) and `idle_prompt` (60s idle). Combined with `UserPromptSubmit` (user sent input) and `Stop` (Claude finished responding), hooks provide exact lifecycle coverage without guessing.

## Goals / Non-Goals

**Goals:**
- Detect all running Claude Code sessions on the local machine via `~/.claude/sessions/`
- Determine precise session state via Claude Code hooks writing state to files
- Support 4 states: **working**, **waiting** (needs approval), **idle** (at prompt), **zombie** (orphaned)
- Gate the entire feature on hook configuration — no hooks = no Claude integration in UI
- Display per-workspace session state in the dashboard table column
- Show aggregated summary with zombie management (kill button) in summary panel
- Surface session info in the system tray menu
- Send desktop notifications on state transitions needing attention

**Non-Goals:**
- Reading Claude's conversational content or message history
- Supporting remote Claude sessions (only local machine)
- Heuristic/fallback detection when hooks aren't configured (hard requirement)

## Decisions

### D1: Session discovery via `~/.claude/sessions/` directory

**Decision**: Read `~/.claude/sessions/*.json` files to discover active sessions. Verify PID liveness with `kill -0 <pid>`. The `sessionId` field correlates with hook state files.

**Rationale**: This is Claude Code's own session tracking mechanism. File-based, simple to poll, contains CWD for workspace mapping and sessionId for hook state correlation.

### D2: Hook-based state detection (replaces heuristics)

**Decision**: Require users to configure Claude Code hooks that write session state to `/tmp/claude-session-state-<sessionId>.json`. The scanner reads these files for precise state.

**Hook events used:**
| Hook Event | Matcher | State Written | Meaning |
|------------|---------|---------------|---------|
| `UserPromptSubmit` | (any) | `"working"` | User sent input, Claude is about to work |
| `Stop` | (any) | `"idle"` | Claude finished responding, at prompt |
| `Notification` | `permission_prompt` | `"waiting"` | Claude needs tool approval |
| `Notification` | `idle_prompt` | `"idle"` | 60s idle at prompt |

**State lifecycle:**
```
User types → UserPromptSubmit("working") → Claude streams → Stop("idle") →
  Claude tries tool → Notification("waiting"/permission_prompt) → User approves →
  Claude continues → Stop("idle") → 60s → Notification("idle"/idle_prompt)
```

**Hook script**: `scripts/claude-session-hook.sh` — reads JSON from stdin, extracts `session_id` and event type, writes state file. The script accepts an optional argument to override the notification type for non-Notification events (UserPromptSubmit, Stop).

**Rationale**: Hooks provide ground-truth state from Claude Code itself. No heuristic can match this accuracy. Making it a hard requirement keeps the implementation clean and the UX honest.

**Alternatives rejected:**
- CPU-time delta — background noise makes idle sessions look active
- Network connections — keep-alive blurs streaming vs idle
- Process state (`R`/`S`) — `R` state is only visible for microseconds during streaming bursts

### D3: Feature gate — hooks required

**Decision**: On scanner initialization, read `~/.claude/settings.json` and check if our hook script is configured in the `Notification`, `UserPromptSubmit`, and `Stop` hook arrays. If not configured, the API returns `{ sessions: [], hookConfigured: false }` and the frontend hides the entire Claude integration (column, summary panel, tray indicators).

**Rationale**: No hooks = no accurate state = misleading UI. Better to show nothing than wrong information. This is documented in the README with copy-paste configuration.

### D4: Zombie detection — entrypoint-aware

**Decision**: Detect orphaned sessions based on their `entrypoint` field:

| Entrypoint | How it runs | Zombie signal |
|------------|-------------|---------------|
| `cli` (tmux/zsh4humans) | Claude → zsh → tmux server | tmux socket has 0 attached clients |
| `cli` (regular terminal) | Claude → zsh → terminal emulator | Grandparent PID is 1 (launchd) |
| `claude-vscode` | Claude → Code Helper (Plugin) | Parent PID is 1 (VS Code closed) |

**Rationale**: Each entrypoint has a different process tree. tmux-based sessions survive window closure by design, so we check tmux client attachment. VS Code extension sessions check if their Code Helper parent is alive.

### D5: Workspace matching by path normalization

**Decision**: Match session CWDs to workspace paths using normalized absolute paths. Strip `file://` prefix, decode percent-encoding, then compare. Match if CWD equals workspace path, is a subdirectory (worktrees), or workspace path is a file inside CWD (`.code-workspace` files).

### D6: API design

**Decision**: `GET /api/claude-sessions` returns:
```json
{
  "hookConfigured": true,
  "sessions": [
    {
      "pid": 52707,
      "sessionId": "769f660e-...",
      "cwd": "/Users/.../vscode-launchpad",
      "startedAt": 1774728030542,
      "entrypoint": "cli",
      "state": "working" | "waiting" | "idle" | "zombie"
    }
  ]
}
```

New endpoint: `POST /api/claude-sessions/kill` accepts `{ pids: [123, 456] }`. Validates each PID is a `claude` process before sending SIGTERM. Returns `{ killed: [...], failed: [...] }`.

**Polling interval**: 5 seconds.

### D7: Frontend — column + summary panel with zombie management

**Decision**:
- **Claude column**: Per-workspace indicators showing working (green pulse), waiting (amber pulse), idle (grey), with separate badges per state when mixed
- **Summary panel**: "Claude: N working, M waiting, K idle" with quick-filter buttons
- **Zombie section in summary**: Shown when zombies exist. Lists each zombie (workspace name, age, PID) with individual "✕" kill buttons and "Kill All" button. Confirmation dialog before kill.
- **Feature hidden** when `hookConfigured === false`

### D8: Tray menu integration

**Decision**: "Claude: N working, M waiting" summary line above workspace entries. Workspace entries annotated with ⚡ (working), ⏳ (waiting). Zombie count shown if any.

### D9: Desktop notifications

**Decision**: Web Notifications API. Fires on `working → waiting` transition (Claude needs approval). Debounced 30s per session. Notification click focuses LaunchPad window.

## Risks / Trade-offs

**[Hook setup is a manual step]** → Users must configure hooks before the feature works. Mitigation: Clear README instructions with copy-paste JSON. Scanner checks on startup and logs a message if hooks are missing.

**[`idle_prompt` is known to be noisy]** → It fires after every response, not just truly idle. Mitigation: We primarily use the `Stop` event for idle detection. `idle_prompt` is a secondary confirmation. If `idle_prompt` proves too noisy, we can remove it without losing core functionality.

**[Session file format is not a public API]** → `~/.claude/sessions/` format may change. Mitigation: Reader is isolated in one module. Fail gracefully on unrecognized format.

**[tmux zombie detection is zsh4humans-specific]** → Other tmux setups may use different socket paths. Mitigation: Socket path is extracted from the tmux process command args, not hardcoded.

**[State file cleanup]** → `/tmp/claude-session-state-*.json` files accumulate. Mitigation: Scanner deletes state files for sessions that no longer exist in `~/.claude/sessions/`.
