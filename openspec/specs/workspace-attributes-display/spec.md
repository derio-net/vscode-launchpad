# workspace-attributes-display Specification

## Purpose
TBD - created by archiving change improve-dashboard-usability. Update Purpose after archive.
## Requirements
### Requirement: Display SSH Host for remote workspaces
The system SHALL extract and display the SSH host/alias for SSH remote workspaces in a dedicated "SSH Host" column.

#### Scenario: SSH host is displayed for SSH remote workspace
- **WHEN** a workspace is of type `ssh-remote` with URI like `vscode://vscode-remote/ssh-remote+myhost@/path`
- **THEN** the SSH Host column displays "myhost"

#### Scenario: SSH Host column is empty for non-SSH workspaces
- **WHEN** a workspace is not of type `ssh-remote` (e.g., local, dev-container, attached-container)
- **THEN** the SSH Host column is empty for that workspace

#### Scenario: SSH host with complex identifiers is parsed correctly
- **WHEN** a workspace URI contains complex SSH identifiers (e.g., `ssh-remote+user@host:port`)
- **THEN** the SSH Host column displays the host identifier correctly

### Requirement: Display workspace path for all workspace types
The system SHALL display the workspace path in a dedicated "Path" column, with content varying by workspace type.

#### Scenario: Local workspace path is displayed
- **WHEN** a workspace is of type `local` with URI `vscode://file/Users/user/projects/myproject`
- **THEN** the Path column displays `/Users/user/projects/myproject`

#### Scenario: SSH remote path is displayed
- **WHEN** a workspace is of type `ssh-remote` with URI `vscode://vscode-remote/ssh-remote+host@/home/user/project`
- **THEN** the Path column displays `/home/user/project`

#### Scenario: Dev container path is displayed
- **WHEN** a workspace is of type `dev-container` with URI `vscode://vscode-remote/dev-container+<container-id>/workspace`
- **THEN** the Path column displays the workspace path from the URI

#### Scenario: Attached container path is displayed
- **WHEN** a workspace is of type `attached-container` with URI `vscode://vscode-remote/attached-container+<id>@ssh-remote+host@/path`
- **THEN** the Path column displays `/path`

### Requirement: Handle missing or malformed attributes gracefully
The system SHALL display empty values for attributes that cannot be extracted or are not applicable to the workspace type.

#### Scenario: Missing SSH host shows empty cell
- **WHEN** a workspace URI is malformed or missing SSH host information
- **THEN** the SSH Host column displays an empty string

#### Scenario: Missing path shows empty cell
- **WHEN** a workspace URI is malformed or missing path information
- **THEN** the Path column displays an empty string

