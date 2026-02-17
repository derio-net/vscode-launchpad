# basic-view-dashboard Specification

## Purpose
TBD - created by archiving change vscode-workspace-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Webserver listens on localhost
The system SHALL run a webserver that listens on localhost (127.0.0.1) on a configurable port (default 3000) and is not accessible from external networks.

#### Scenario: Server starts successfully
- **WHEN** the application is started
- **THEN** the webserver listens on http://localhost:3000

#### Scenario: Server rejects external connections
- **WHEN** an external client attempts to connect to the server
- **THEN** the connection is rejected or the server only binds to localhost

### Requirement: Read workspace JSON files from VS Code storage
The system SHALL read all workspace JSON files from `~/Library/Application \Support/Code/User/workspaceStorage/*/workspace.json` on startup and parse them to extract workspace metadata.

#### Scenario: Workspace files are discovered
- **WHEN** the server starts
- **THEN** all JSON files in the workspace storage directory are read and parsed

#### Scenario: Malformed JSON files are handled gracefully
- **WHEN** a workspace JSON file is malformed or unreadable
- **THEN** the file is skipped with an error logged, and the server continues processing other files

#### Scenario: Workspace metadata is extracted
- **WHEN** a valid workspace JSON file is read
- **THEN** the system extracts workspace name, path, and other relevant metadata

### Requirement: Supported formats
The system SHALL initially support the following basic workspace formats:
- {
  "workspace": "file://${HOME_PATH}/Library/Application%20Support/Code/Workspaces/1687267072927/workspace.json"
}
- {
  "folder": "file://${HOME_PATH}/DevOpsCon-Workshop"
}
- {
  "workspace": "file://${HOME_PATH}/Docs/projects/HOMELAB/HOMELAB.code-workspace"
}
- {
  "folder": "vscode-remote://dev-container<SEPARATOR><REMOTE_WORKSPACE>"
}
- {
  "folder": "vscode-remote://attached-container<SEPARATOR><REMOTE_ID>@ssh-remote<SEPARATOR><REMOTE_WORKSPACE>"
}
- {
  "folder": "vscode-remote://ssh-remote<SEPARATOR><SSH_ALIAS><REMOTE_WORKSPACE>"
}

#### Scenario: Workspace files are discovered
- **WHEN** the server starts
- **THEN** all JSON files in the workspace storage directory are read and parsed

#### Scenario: Malformed JSON files are handled gracefully
- **WHEN** a workspace JSON file is malformed or unreadable
- **THEN** the file is skipped with an error logged, and the server continues processing other files

#### Scenario: Workspace metadata is extracted
- **WHEN** a valid workspace JSON file is read
- **THEN** the system extracts workspace name, path, and other relevant metadata

### Requirement: Expose workspace data via REST API
The system SHALL provide a REST API endpoint that returns all discovered workspaces as JSON.

#### Scenario: API returns workspace list
- **WHEN** a GET request is made to `/api/workspaces`
- **THEN** the system returns a JSON array of all discovered workspaces with their metadata

#### Scenario: API response includes required fields
- **WHEN** a GET request is made to `/api/workspaces`
- **THEN** each workspace object includes: name, path, and last modified date

### Requirement: Display dashboard UI
The system SHALL serve a web-based dashboard that displays all workspaces in a user-friendly format with resizable columns and detailed workspace attributes.

#### Scenario: Dashboard loads successfully
- **WHEN** a user navigates to http://localhost:3010
- **THEN** the dashboard UI loads and displays a list of all workspaces with resizable columns

#### Scenario: Dashboard displays workspace information with new columns
- **WHEN** the dashboard is loaded
- **THEN** each workspace is displayed with columns: Name, Last Modified, Type, SSH Host, and Path in a sortable, resizable table

#### Scenario: Column widths are resizable
- **WHEN** a user positions the cursor on the border between column headers
- **THEN** the cursor changes to indicate the column is resizable, and the user can drag to resize

#### Scenario: SSH Host column shows remote host information
- **WHEN** a remote workspace (SSH, dev container, attached container) is displayed
- **THEN** the SSH Host column displays the SSH host for SSH remotes, or is empty for other types

#### Scenario: Path column shows workspace path
- **WHEN** any workspace is displayed
- **THEN** the Path column displays the workspace path (local path for local workspaces, remote path for remote workspaces)

### Requirement: Search and filter workspaces
The system SHALL allow users to search and filter workspaces by name or path.

#### Scenario: User searches by workspace name
- **WHEN** a user enters text in the search field
- **THEN** the dashboard filters workspaces to show only those matching the search term

#### Scenario: User filters by workspace path
- **WHEN** a user enters a path fragment in the search field
- **THEN** the dashboard filters workspaces to show only those with matching paths

### Requirement: Sort workspace list
The system SHALL allow users to sort the workspace list by name, path, last modified date, SSH host, or extracted workspace path.

#### Scenario: User sorts by name
- **WHEN** a user clicks the "Name" column header
- **THEN** the workspace list is sorted alphabetically by name

#### Scenario: User sorts by last modified date
- **WHEN** a user clicks the "Last Modified" column header
- **THEN** the workspace list is sorted by date (newest first or oldest first on toggle)

#### Scenario: User sorts by SSH host
- **WHEN** a user clicks the "SSH Host" column header
- **THEN** the workspace list is sorted alphabetically by SSH host (extracted from remote workspace URIs), with empty values sorted to the end

#### Scenario: User sorts by workspace path
- **WHEN** a user clicks the "Path" column header
- **THEN** the workspace list is sorted alphabetically by the extracted workspace path

### Requirement: Periodic workspace refresh
The system SHALL periodically refresh the workspace list to detect new or removed workspaces.

#### Scenario: Workspaces are refreshed on interval
- **WHEN** the configured refresh interval elapses (default 30 seconds)
- **THEN** the system re-scans the workspace storage directory and updates the in-memory cache

#### Scenario: Dashboard reflects updated workspace list
- **WHEN** new workspaces are added to the storage directory
- **THEN** they appear in the dashboard after the next refresh interval

### Requirement: Workspace links open in VS Code
The system SHALL generate clickable workspace links that open the workspace in VS Code using the appropriate protocol handler.

#### Scenario: Local workspace link opens in VS Code
- **WHEN** a user clicks on a local workspace link
- **THEN** VS Code opens the workspace at the specified file path

#### Scenario: Remote workspace link opens in VS Code
- **WHEN** a user clicks on a remote workspace link (SSH, dev container, or attached container)
- **THEN** VS Code opens the remote workspace using the correct `vscode://vscode-remote/` protocol format

#### Scenario: Remote workspace link is correctly formatted
- **WHEN** a remote workspace is displayed in the dashboard
- **THEN** the href attribute uses the `vscode://vscode-remote/` format that VS Code recognizes

### Requirement: Prop stability for Dashboard component
The system SHALL ensure stable prop references are passed to the Dashboard component to prevent unnecessary re-renders and infinite loop issues.

#### Scenario: Workspaces array has stable reference
- **WHEN** the App component renders the Dashboard
- **THEN** the workspaces prop SHALL be memoized using `useMemo` to ensure reference stability across re-renders

#### Scenario: Refresh callback has stable reference
- **WHEN** the App component renders the Dashboard
- **THEN** the onRefresh callback SHALL be memoized using `useCallback` to prevent unnecessary effect re-executions in child components

#### Rationale
Without memoization, each render of App creates new array/function references, triggering Dashboard's `useEffect` hooks that depend on these props, potentially causing infinite loops or excessive re-renders.

### Requirement: State management for error handling
The system SHALL maintain proper state for error recovery and retry mechanisms.

#### Scenario: Retry count is tracked
- **WHEN** a user clicks the retry button after an error
- **THEN** the system increments a `retryCount` state to trigger a fresh data fetch

#### Scenario: Loading state is managed during retries
- **WHEN** a retry is initiated
- **THEN** the loading state is set to true and error state is cleared before attempting to fetch data again

