## Why

When running Claude Code in multiple VS Code terminal windows simultaneously, it's easy to lose track of which sessions are active, which are waiting for user input, and which are in specific modes (plan mode, accepting edits, streaming, etc.). Missed prompts lead to wasted time — Claude may be blocked waiting for approval while you're focused on another window. LaunchPad already knows about your VS Code workspaces; surfacing live Claude session state per workspace turns it into a command center for concurrent AI-assisted development.

## What Changes

- Detect running Claude Code processes on the system and map them to known VS Code workspaces by matching working directories
- Poll or watch for Claude Code session state (idle, streaming, waiting for user input, plan mode, etc.) and expose it via the backend API
- Display live Claude session indicators on each workspace row in the dashboard — showing session count, current mode/state, and a visual alert when Claude is waiting for user input
- Add a filterable view or summary showing all active Claude sessions across workspaces
- Emit desktop notifications (Tauri) when a Claude session transitions to "waiting for user input" state
- Add Claude session status to the system tray menu for quick glance

## Capabilities

### New Capabilities
- `claude-session-detection`: Process-level detection of running Claude Code sessions, mapping them to workspace directories, and polling their current state/mode
- `claude-session-dashboard`: Frontend UI for displaying live Claude session status per workspace — indicators, state badges, attention alerts, and a summary/filter view

### Modified Capabilities
- `basic-view-dashboard`: Dashboard table gains a Claude session status column showing active session count and state per workspace
- `status-menu`: Tray menu gains Claude session status indicators alongside workspace entries, and attention alerts for sessions waiting on user input

## Impact

- **Backend** (`server/`): New module for Claude Code process detection and state polling; new API endpoints to expose session data; new polling interval for process scanning
- **Frontend** (`src/`): New column/indicators in workspace table; new summary panel or filter for Claude sessions; notification permission handling
- **Desktop** (`src-tauri/`): Desktop notification integration for "waiting for input" alerts; possible Tauri event bridge for session state updates
- **Dependencies**: May need OS-specific process inspection utilities (macOS `lsof`/`ps`, Linux `/proc` filesystem, Windows `wmic`); investigation needed into Claude Code's internal state files (`~/.claude/`) for state detection
- **Performance**: Process scanning adds a periodic system call; needs to be lightweight and not impact dashboard responsiveness
