## Why

A Claude Code session appears on the dashboard only when its working folder is, or sits inside, a workspace that VS Code remembers. Sessions started from a terminal in a folder never opened in VS Code, or opened only under another path (an old location, an fr worktree, a dev container), have no row to land on. On a real machine (2026-11-01) that was **10 of 14 live sessions**, including the only `working` one. The summary panel still counts them, so the dashboard says "1 working" and then shows no row for it. Worse, clicking the **working** / **waiting** filter then empties the table, because the filter only keeps workspace rows.

## What Changes

- The summary panel lists **sessions that match no workspace** under an "Other sessions" section. Sessions are grouped by folder (one entry per folder, with per-state counts), so you can see where every live session is.
- Each "Other sessions" entry offers **Open in VS Code**, which opens that folder in VS Code. VS Code then adds it to its recent workspaces, so on the next workspace refresh the folder gets a normal row with its session indicators.
- The **working** / **waiting** filters stay workspace filters. When the selected state has sessions only in unmatched folders, the table shows an empty-state message pointing at "Other sessions" instead of an unexplained empty table.
- Zombie handling is unchanged: zombies stay in the zombie section and are not listed under "Other sessions".
- Opening a workspace and opening a folder share one URI helper (today the `vscode://file…` logic lives inside `WorkspaceTable`).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `claude-session-dashboard`: adds requirements for listing unmatched sessions in the summary panel, opening their folder in VS Code, and the filter empty state. The existing "Workspace with no sessions" and "Zombie sessions are not shown in workspace column" scenarios are unchanged.

## Impact

- **Frontend:**
  - `src/hooks/useClaudeSessions.js`: expose the live sessions that `buildSessionWorkspaceMap` did not place
  - `src/components/ClaudeSessionSummary.js` + CSS: the "Other sessions" section
  - `src/components/Dashboard.js`: pass the new data through and add the filter empty state
  - `src/components/WorkspaceTable.js`: move its open logic to a shared util in `src/utils/workspaceUtils.js`
- **Desktop:** reuses the existing `open_vscode` Tauri command with a `vscode://file/<folder>` URI; no Rust changes expected.
- **Backend / API:** none. `/api/claude-sessions` already returns every live session with its `cwd`.
- **Tests:** unit tests for the unmatched-session grouping, the summary section, the open action and the filter empty state, plus a Playwright case with mocked sessions in an unknown folder.
- **Out of scope:** sessions whose `cwd` is inside a container (they never appear in the host's `~/.claude/sessions/`), and remapping moved or renamed paths automatically.
