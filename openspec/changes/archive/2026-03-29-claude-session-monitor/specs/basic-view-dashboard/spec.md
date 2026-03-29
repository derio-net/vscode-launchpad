## MODIFIED Requirements

### Requirement: Display dashboard UI
The system SHALL serve a web-based dashboard that displays all workspaces in a user-friendly format with resizable columns, detailed workspace attributes, and live Claude Code session status.

#### Scenario: Dashboard loads successfully
- **WHEN** a user navigates to http://localhost:3010
- **THEN** the dashboard UI loads and displays a list of all workspaces with resizable columns

#### Scenario: Dashboard displays workspace information with new columns
- **WHEN** the dashboard is loaded
- **THEN** each workspace is displayed with columns: Name, Last Accessed, Type, Claude, Connection, and Path in a sortable, resizable table

#### Scenario: Column widths are resizable
- **WHEN** a user positions the cursor on the border between column headers
- **THEN** the cursor changes to indicate the column is resizable, and the user can drag to resize

#### Scenario: SSH Host column shows remote host information
- **WHEN** a remote workspace (SSH, dev container, attached container) is displayed
- **THEN** the SSH Host column displays the SSH host for SSH remotes, or is empty for other types

#### Scenario: Path column shows workspace path
- **WHEN** any workspace is displayed
- **THEN** the Path column displays the workspace path (local path for local workspaces, remote path for remote workspaces)

#### Scenario: Claude column shows session indicators
- **WHEN** a workspace has one or more active Claude Code sessions
- **THEN** the Claude column SHALL display a session count badge with a state indicator dot (green for active, amber for idle/waiting)

### Requirement: Sort workspace list
The system SHALL allow users to sort the workspace list by name, path, last accessed date, SSH host, extracted workspace path, or Claude session status. Default sort is by last-accessed descending.

#### Scenario: Default sort is by last accessed date descending
- **WHEN** the dashboard loads with no user-specified sort
- **THEN** the workspace list SHALL be sorted by last-accessed date, newest first

#### Scenario: User sorts by name
- **WHEN** a user clicks the "Name" column header
- **THEN** the workspace list is sorted alphabetically by name

#### Scenario: User sorts by last accessed date
- **WHEN** a user clicks the "Last Accessed" column header
- **THEN** the workspace list is sorted by last-accessed date (newest first or oldest first on toggle)

#### Scenario: User sorts by SSH host
- **WHEN** a user clicks the "SSH Host" column header
- **THEN** the workspace list is sorted alphabetically by SSH host (extracted from remote workspace URIs), with empty values sorted to the end

#### Scenario: User sorts by workspace path
- **WHEN** a user clicks the "Path" column header
- **THEN** the workspace list is sorted alphabetically by the extracted workspace path

#### Scenario: User sorts by Claude session status
- **WHEN** a user clicks the "Claude" column header
- **THEN** the workspace list SHALL be sorted by Claude session count descending (workspaces with idle sessions first, then active, then no sessions)

### Requirement: Periodic workspace refresh
The system SHALL periodically refresh the workspace list and Claude session data to detect changes.

#### Scenario: Workspaces are refreshed on interval
- **WHEN** the configured refresh interval elapses (default 30 seconds)
- **THEN** the system re-scans the workspace storage directory and updates the in-memory cache

#### Scenario: Claude sessions are refreshed on interval
- **WHEN** the Claude session polling interval elapses (default 5 seconds)
- **THEN** the system SHALL fetch updated session data and refresh the Claude column indicators
- **AND** the refresh SHALL NOT reset the table's current sort order, filters, or scroll position

#### Scenario: Dashboard reflects updated workspace list
- **WHEN** new workspaces are added to the storage directory
- **THEN** they appear in the dashboard after the next refresh interval
