# basic-view-dashboard Delta Specification

## MODIFIED Requirements

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
