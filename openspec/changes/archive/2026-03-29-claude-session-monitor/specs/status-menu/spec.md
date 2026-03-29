## MODIFIED Requirements

### Requirement: Dynamic workspace quick-access menu
The system SHALL display recently accessed workspaces in the tray context menu for quick access, with Claude session indicators on workspaces that have active sessions.

#### Scenario: Recent workspaces are shown in the menu
- **WHEN** the user opens the tray context menu
- **THEN** the menu SHALL display up to 10 of the most recently accessed workspaces by name
- **AND** each workspace entry SHALL be prefixed with a type indicator emoji
- **AND** the workspace entries SHALL appear above the standard menu items (Show Dashboard, Check for Updates, Quit)
- **AND** a separator SHALL divide the workspace entries from the standard items

#### Scenario: Workspace with Claude sessions shows indicator
- **WHEN** a workspace has one or more active Claude Code sessions
- **THEN** the workspace entry label SHALL include a Claude indicator suffix (e.g., "🔵 my-project ⚡2" for 2 active sessions)

#### Scenario: Workspace with idle Claude session shows attention marker
- **WHEN** a workspace has one or more idle/waiting Claude sessions
- **THEN** the workspace entry label SHALL include an attention indicator suffix (e.g., "🔵 my-project ⏳1" for 1 idle session)

#### Scenario: Clicking a workspace entry opens it in VS Code
- **WHEN** the user clicks an enabled workspace entry in the tray menu
- **THEN** the system SHALL open that workspace in VS Code using the same mechanism as the dashboard's open action

#### Scenario: No workspaces available
- **WHEN** no workspaces are found or the backend is offline
- **THEN** the menu SHALL display a disabled item with the text "No workspaces found"
- **AND** the standard menu items SHALL still be present and functional

## ADDED Requirements

### Requirement: Claude session summary in tray menu
The system SHALL display an aggregate Claude session status line in the tray context menu.

#### Scenario: Sessions summary is shown
- **WHEN** one or more Claude Code sessions are running
- **THEN** the tray menu SHALL include a disabled status item showing "Claude: N active, M waiting" above the workspace list
- **AND** a separator SHALL divide this status line from the workspace entries below

#### Scenario: No sessions running
- **WHEN** no Claude Code sessions are detected
- **THEN** the Claude session summary line SHALL NOT appear in the tray menu

### Requirement: Tray menu refresh includes Claude session data
The system SHALL include Claude session data when refreshing the tray menu.

#### Scenario: Claude data is fetched during tray refresh
- **WHEN** the tray menu refresh cycle runs (every 30 seconds or on event)
- **THEN** the system SHALL also fetch Claude session data from the `/api/claude-sessions` endpoint
- **AND** use it to annotate workspace entries and display the session summary

#### Scenario: Claude API failure does not break tray menu
- **WHEN** the `/api/claude-sessions` endpoint is unreachable or returns an error during tray refresh
- **THEN** workspace entries SHALL be displayed without Claude indicators
- **AND** the Claude session summary line SHALL NOT appear
- **AND** the rest of the tray menu SHALL function normally
