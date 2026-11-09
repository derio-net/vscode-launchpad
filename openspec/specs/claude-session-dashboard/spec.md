# claude-session-dashboard Specification

## Purpose
Define how Claude Code session status is presented in the dashboard: gating on hook configuration, workspace-row indicators, the summary panel, zombie management, live updates, notifications, and the Claude column.
## Requirements
### Requirement: Claude integration gated on hook configuration
The system SHALL hide all Claude session UI elements (column, summary panel, indicators) when hooks are not configured, and SHALL show them when hook configuration is detected asynchronously. The hook management control and repair banner (see below) are not gated.

#### Scenario: Hooks not configured
- **WHEN** the API returns `hookConfigured: false`
- **THEN** the Claude column, summary panel, and all Claude indicators SHALL be hidden

#### Scenario: Hooks are configured
- **WHEN** the API returns `hookConfigured: true`
- **THEN** the Claude column and summary panel SHALL be visible

#### Scenario: Hook configuration detected after initial render
- **WHEN** the component mounts before the API has responded
- **AND** the API subsequently returns `hookConfigured: true`
- **THEN** the Claude column SHALL become visible without requiring a page reload
- **AND** this SHALL NOT override a user's manual column visibility toggle

### Requirement: Claude session indicators in workspace table
The system SHALL display Claude Code session status for each workspace row in the dashboard table with 4 distinct states.

#### Scenario: Workspace with working sessions
- **WHEN** a workspace has sessions in "working" state
- **THEN** the indicator SHALL show a green pulsing dot with count

#### Scenario: Workspace with waiting sessions
- **WHEN** a workspace has sessions in "waiting" state (needs tool approval)
- **THEN** the indicator SHALL show an amber pulsing dot with count

#### Scenario: Workspace with idle sessions
- **WHEN** a workspace has sessions in "idle" state
- **THEN** the indicator SHALL show a grey dot with count

#### Scenario: Workspace with mixed states
- **WHEN** a workspace has sessions in multiple states (e.g., 1 working + 2 waiting)
- **THEN** separate badges SHALL be shown for each state with individual counts

#### Scenario: Workspace with no sessions
- **WHEN** no sessions match a workspace path
- **THEN** the workspace row SHALL display no Claude indicator

#### Scenario: Zombie sessions are not shown in workspace column
- **WHEN** a workspace has only zombie sessions
- **THEN** the workspace row SHALL NOT show a Claude indicator (zombies are managed in the summary panel)

### Requirement: Claude sessions summary panel
The system SHALL display an aggregated summary above the workspace table.

#### Scenario: Summary shows state counts
- **WHEN** Claude sessions are detected
- **THEN** the summary SHALL display working, waiting, and idle counts

#### Scenario: Summary provides quick filters
- **WHEN** the user clicks a state count in the summary
- **THEN** the workspace table SHALL filter to show only workspaces with sessions in that state

#### Scenario: Summary is hidden when no sessions and no zombies
- **WHEN** no Claude sessions are running and no zombies exist
- **THEN** the summary panel SHALL NOT be displayed

### Requirement: Zombie management in summary panel
The system SHALL display zombie sessions in the summary panel with kill controls.

#### Scenario: Zombies are listed with details
- **WHEN** zombie sessions exist
- **THEN** the summary panel SHALL show a zombie section with each zombie's workspace name, age (time since `startedAt`), and PID

#### Scenario: Individual zombie kill button
- **WHEN** a zombie entry is displayed
- **THEN** it SHALL have a "✕" button to kill that individual session

#### Scenario: Kill All zombies button
- **WHEN** multiple zombies exist
- **THEN** a "Kill All" button SHALL be shown to terminate all zombies at once

#### Scenario: Kill confirmation dialog
- **WHEN** the user clicks a kill button (individual or Kill All)
- **THEN** a confirmation dialog SHALL be shown before sending the kill request

#### Scenario: Kill success feedback
- **WHEN** zombie processes are successfully killed
- **THEN** the zombie entries SHALL be removed on the next poll cycle

### Requirement: Real-time session state updates
The system SHALL poll the backend API and update indicators without full page reload.

#### Scenario: Indicators update on poll cycle
- **WHEN** the session polling interval elapses (5 seconds)
- **THEN** the dashboard SHALL fetch `/api/claude-sessions` and update all indicators
- **AND** the update SHALL NOT reset table sort, filter, or scroll position

### Requirement: Desktop notifications for waiting sessions
The system SHALL send desktop notifications when a session transitions to waiting state.

#### Scenario: Notification on working-to-waiting transition
- **WHEN** a session transitions from "working" to "waiting"
- **THEN** the system SHALL display a desktop notification with the workspace name

#### Scenario: Notification debouncing
- **WHEN** a session rapidly toggles state
- **THEN** notifications SHALL be debounced to at most one per session per 30 seconds

#### Scenario: Notification click focuses app
- **WHEN** the user clicks a desktop notification
- **THEN** the LaunchPad window SHALL be focused

### Requirement: Claude column is sortable and toggleable
The system SHALL support sorting and visibility toggling for the Claude column.

#### Scenario: Column is sortable by urgency
- **WHEN** the user clicks the Claude column header
- **THEN** workspaces SHALL be sorted by session urgency (waiting > working > idle > none)

#### Scenario: Column visibility toggle
- **WHEN** the user uses the column visibility menu
- **THEN** the Claude column SHALL be hideable and restorable

### Requirement: Claude Code status control
The dashboard SHALL provide a control for enabling, repairing and disabling the Claude Code hook, driven by the hook installation status.

#### Scenario: Enable when not installed
- **WHEN** the hook status is `not-installed`
- **THEN** the control SHALL offer **Enable Claude Code status**
- **AND** choosing it SHALL call the install endpoint and, on success, reveal the Claude column without a page reload

#### Scenario: Repair when broken
- **WHEN** the hook status is `needs-repair`
- **THEN** the control SHALL offer **Repair**, which calls the install endpoint

#### Scenario: Disable when installed
- **WHEN** the hook status is `installed`
- **THEN** the control SHALL offer **Disable Claude Code status**
- **AND** choosing it SHALL ask for confirmation, call the remove endpoint, and hide the Claude UI

#### Scenario: Unsupported environment
- **WHEN** the hook status is `unsupported`
- **THEN** the control SHALL NOT be shown

#### Scenario: Action fails
- **WHEN** the install or remove request fails
- **THEN** the dashboard SHALL show the error message returned by the server
- **AND** the displayed status SHALL remain unchanged

### Requirement: Repair banner for broken hooks
The dashboard SHALL show a banner when the hook status is `needs-repair`, because a broken hook surfaces as a Claude Code error on every turn.

#### Scenario: Banner shown
- **WHEN** the hook status is `needs-repair`
- **THEN** a banner SHALL explain that the Claude Code hooks point at a missing or outdated script and offer a **Repair** button

#### Scenario: Banner dismissed
- **WHEN** the user dismisses the banner
- **THEN** it SHALL stay hidden for that viewer until the hook status changes

#### Scenario: No banner when simply not installed
- **WHEN** the hook status is `not-installed`
- **THEN** no banner SHALL be shown

### Requirement: Unmatched sessions listed in the summary panel
The summary panel SHALL list live Claude sessions whose working folder matches no workspace row, so that every live, non-zombie session is visible either on a workspace row or in this list.

#### Scenario: Session in a folder VS Code does not list
- **WHEN** a live session's `cwd` is `/Users/dev/tools/agent` and no workspace path equals, contains, or is contained by that folder
- **THEN** the summary panel SHALL show an "Other sessions" section with an entry for `/Users/dev/tools/agent`
- **AND** the entry SHALL display the folder name (`agent`), with the full path available as a tooltip

#### Scenario: Several sessions in the same folder
- **WHEN** three live sessions (one working, two idle) share an unmatched `cwd`
- **THEN** the section SHALL show a single entry for that folder with counts "1 working" and "2 idle"
- **AND** the entry's status indicator SHALL reflect the most urgent state (waiting > working > idle)

#### Scenario: Folders with the same name
- **WHEN** unmatched folders `/Users/dev/DERIO_NET/triage-state` and `/Users/dev/STOA/triage-state` are both listed
- **THEN** their entries SHALL show enough parent folders to tell them apart (`DERIO_NET/triage-state`, `STOA/triage-state`)

#### Scenario: Ordering
- **WHEN** there are several unmatched folders
- **THEN** entries SHALL be ordered by most urgent state first, then by folder name

#### Scenario: Matched sessions are not repeated
- **WHEN** a session matches a workspace row
- **THEN** it SHALL NOT appear in the "Other sessions" section

#### Scenario: Zombies are not listed
- **WHEN** an unmatched session is a zombie
- **THEN** it SHALL appear only in the zombie section, not under "Other sessions"

#### Scenario: Long list is capped
- **WHEN** there are more than 5 unmatched folders
- **THEN** only the first 5 entries SHALL be shown, with a "Show all (N)" control that reveals the rest

#### Scenario: No unmatched sessions
- **WHEN** every live session matches a workspace row
- **THEN** the "Other sessions" section SHALL NOT be rendered

### Requirement: Open an unmatched folder in VS Code
Each "Other sessions" entry SHALL offer an action that opens its folder in VS Code, so that the folder joins VS Code's workspace list and its sessions move onto a workspace row.

#### Scenario: Open in desktop mode
- **WHEN** the user clicks **Open in VS Code** on the entry for `/Users/dev/tools/agent` in the desktop app
- **THEN** the system SHALL invoke the `open_vscode` command with `vscode://file/Users/dev/tools/agent`

#### Scenario: Paths with special characters
- **WHEN** the folder path contains spaces or URI-reserved characters (e.g. `/Users/dev/my project#2`)
- **THEN** each path segment SHALL be URI-encoded while `/` separators are preserved (`vscode://file/Users/dev/my%20project%232`)

#### Scenario: Workspace list catches up
- **WHEN** VS Code has opened the folder and the workspace list next refreshes
- **THEN** the folder SHALL appear as a workspace row with its session indicators
- **AND** its entry SHALL no longer appear under "Other sessions"

#### Scenario: Opening workspaces is unchanged
- **WHEN** the user clicks a workspace name in the table
- **THEN** it SHALL open exactly as before (local, SSH remote, dev container and attached container URIs unchanged)

### Requirement: Claude filter explains an empty result
When a Claude state filter (working or waiting) matches no workspace rows, the table SHALL explain why instead of showing a generic empty state.

#### Scenario: Filtered state exists only in unmatched folders
- **WHEN** the user activates the **working** filter
- **AND** no workspace row has a working session
- **AND** one working session is in an unmatched folder
- **THEN** the table SHALL show a message stating that no workspace rows have working sessions and that 1 is in a folder VS Code doesn't list, pointing to "Other sessions"

#### Scenario: Empty for other reasons
- **WHEN** the table is empty and no Claude filter is active, or the filtered state has no unmatched sessions either
- **THEN** the table SHALL show the existing "No workspaces found" message

