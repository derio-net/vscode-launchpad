## ADDED Requirements

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
