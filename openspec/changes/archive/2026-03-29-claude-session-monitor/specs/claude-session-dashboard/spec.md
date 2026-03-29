## ADDED Requirements

### Requirement: Claude integration gated on hook configuration
The system SHALL hide all Claude session UI elements when hooks are not configured.

#### Scenario: Hooks not configured
- **WHEN** the API returns `hookConfigured: false`
- **THEN** the Claude column, summary panel, and all Claude indicators SHALL be hidden

#### Scenario: Hooks are configured
- **WHEN** the API returns `hookConfigured: true`
- **THEN** the Claude column and summary panel SHALL be visible

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
