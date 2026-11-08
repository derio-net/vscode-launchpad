## Context

`useClaudeSessions` polls `/api/claude-sessions` and builds `sessionMap` (workspace path → sessions) with `buildSessionWorkspaceMap`. A session lands on the first workspace whose path equals its `cwd` or contains it (either direction). Live sessions that match nothing are dropped from the map. They still count in `summary` (computed from all live sessions), so `ClaudeSessionSummary` shows "1 working" with no row behind it.

The **working** / **waiting** buttons set `claudeFilter`. `Dashboard`'s `filteredAndSortedWorkspaces` then keeps only rows whose sessions include that state. When the only such session is unmatched, the table falls through to `WorkspaceTable`'s generic "No workspaces found" row.

Opening a workspace is implemented inside `WorkspaceTable`:
- `convertToVSCodeURI` turns a local path into `vscode://file/<encoded path>`
- `handleWorkspaceClick` calls `invoke('open_vscode', { uri })` in Tauri (falling back to the shell plugin's `open`), or navigates to the URI in a browser.

## Goals / Non-Goals

**Goals:**
- Every live, non-zombie session is visible somewhere: on a workspace row, or under "Other sessions".
- One click opens an unmatched folder in VS Code, after which it becomes a normal workspace row.
- The working/waiting filters never produce an unexplained empty table.

**Non-Goals:**
- Changing how sessions are matched to workspaces (no fuzzy or moved-path matching).
- Showing sessions from inside containers (not in the host's `~/.claude/sessions/`).
- Synthesising rows for folders VS Code doesn't know about. Rows remain VS Code's workspace list.
- Backend or API changes.

## Decisions

### D1. Compute unmatched sessions in the hook, grouped by folder
Add a pure, exported `groupUnmatchedSessions(sessions, sessionMap)`: live sessions not present in any `sessionMap` value, grouped by normalised `cwd` (same normalisation as matching). Each group is `{ cwd, name, sessions, counts: { working, waiting, idle }, state }`, where `name` is the last path segment and `state` comes from `getAggregateState`. Groups are sorted by urgency (waiting > working > idle), then by name. `useClaudeSessions` returns it as `unmatched`.

Grouping matters because several sessions often share a folder (4 in `super-fr` on the reporting machine); one row per session would be noise.

*Alternative:* compute in `ClaudeSessionSummary` from raw sessions. Rejected: the hook already owns matching, and keeping the logic pure there makes it unit-testable next to `buildSessionWorkspaceMap`.

### D2. "Other sessions" section in the summary panel
`ClaudeSessionSummary` gets an `unmatched` prop and renders a section below the live counts and above zombies:
- header "Other sessions (N folders)" with a one-line hint: "not in VS Code's workspace list"
- one entry per group: a status dot for the aggregate state, folder name (full path in `title`), per-state counts, and an **Open in VS Code** button
- at most 5 entries by default, then a "Show all (N)" toggle, so a busy machine doesn't push the table off-screen

The panel's existing "hidden when no sessions and no zombies" rule is unchanged. The section renders only when `unmatched.length > 0`.

### D3. One shared "open in VS Code" helper
Move the URI and open logic from `WorkspaceTable` into `src/utils/workspaceUtils.js`:
- `toVSCodeUri(workspace)`: today's `convertToVSCodeURI`, unchanged behaviour
- `folderToVSCodeUri(path)`: `vscode://file` plus the per-segment-encoded path
- `openVSCodeUri(uri)`: Tauri `invoke('open_vscode')` with the shell-`open` fallback, else `window.location.href = uri`

`WorkspaceTable` keeps its web-mode special cases for remote workspaces and calls the shared helpers. The summary's Open button calls `openVSCodeUri(folderToVSCodeUri(group.cwd))`. There are no Rust changes: `open_vscode` already opens any URL.

### D4. Let the workspace list catch up instead of predicting it
After **Open**, VS Code records the folder in `workspaceStorage`. The server's workspace scan (30 s interval) and the dashboard's refresh then pick it up, and the session moves from "Other sessions" to a row on its own. Clicking Open also schedules one `onRefresh()` call about 10 s later, so it usually happens sooner. Nothing is hidden optimistically: if VS Code fails to open, the entry simply stays.

### D5. Filter empty state names the cause
`Dashboard` passes `WorkspaceTable` an `emptyMessage` when a Claude filter is active, the filtered rows are empty, and `unmatched` has sessions in that state. The message reads, e.g.: "No workspace rows have working sessions. 1 is in a folder VS Code doesn't list; see Other sessions above." Otherwise the table keeps "No workspaces found".

*Alternative:* make the filter also expand "Other sessions". Rejected as extra state for little gain; the message is enough.

## Risks / Trade-offs

- **Opening a folder VS Code would open as a dev container or remote** → VS Code may offer "Reopen in Container", and the new row may then be a dev-container workspace whose path doesn't match the host `cwd`. The entry then stays under "Other sessions". Accepted, and documented in the hint's tooltip.
- **A session in a subfolder of a listed workspace already matches that workspace**, so it never appears under "Other sessions". That is existing matching behaviour, unchanged.
- **Long lists** → capped at 5 with "Show all".
- **Refactoring `WorkspaceTable`'s open logic** could regress opening workspaces → existing workspace-opening unit and E2E tests must keep passing, and the moved helpers get their own unit tests.

## Migration Plan

Frontend only; ships with the next release. No data or settings migration; rollback is reverting the PR.

## Open Questions

- None blocking. Possible follow-up: offer "Remove from list" for a stale folder, or remember dismissed folders.
