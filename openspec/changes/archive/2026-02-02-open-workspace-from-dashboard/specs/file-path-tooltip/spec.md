# file-path-tooltip Specification

## Purpose
Display the full file path of workspaces as tooltips when users hover over workspace names in the dashboard, providing clarity about workspace locations.

## Requirements

### Requirement: Display full path on hover
The system SHALL display the complete file path of a workspace when a user hovers over the workspace name.

#### Scenario: User hovers over workspace name
- **WHEN** a user hovers over a workspace name in the dashboard table
- **THEN** a tooltip appears showing the full file path of that workspace

#### Scenario: Tooltip displays for sufficient duration
- **WHEN** a tooltip is displayed
- **THEN** it remains visible while the user's cursor is over the workspace name

#### Scenario: Tooltip disappears on mouse leave
- **WHEN** a user moves the cursor away from the workspace name
- **THEN** the tooltip disappears

### Requirement: Show correct path for different workspace types
The system SHALL display the appropriate path for different workspace types (local folders, workspace files, remote workspaces).

#### Scenario: Local folder workspace path is shown
- **WHEN** a user hovers over a local folder workspace
- **THEN** the tooltip displays the absolute path to the folder (e.g., `/Users/name/Projects/my-project`)

#### Scenario: Workspace file path is shown
- **WHEN** a user hovers over a .code-workspace file workspace
- **THEN** the tooltip displays the absolute path to the workspace file (e.g., `/Users/name/my-workspace.code-workspace`)

#### Scenario: Remote workspace path is shown
- **WHEN** a user hovers over a remote workspace (SSH, dev container, etc.)
- **THEN** the tooltip displays the remote path in the appropriate format (e.g., `ssh://host/path` or `dev-container://container-id/path`)

### Requirement: Tooltip is accessible
The system SHALL ensure tooltips are accessible to all users, including those using assistive technologies.

#### Scenario: Tooltip text is announced by screen readers
- **WHEN** a user with a screen reader hovers over a workspace name
- **THEN** the full path is announced by the screen reader

#### Scenario: Tooltip is keyboard accessible
- **WHEN** a user navigates to a workspace name using keyboard
- **THEN** the tooltip is displayed and the path information is available

### Requirement: Handle long paths gracefully
The system SHALL display long file paths in tooltips without breaking the layout or becoming unusable.

#### Scenario: Long path is displayed in tooltip
- **WHEN** a workspace has a very long file path
- **THEN** the tooltip displays the full path without truncation or wrapping that makes it unreadable

#### Scenario: Tooltip positioning for edge cases
- **WHEN** a workspace near the edge of the screen is hovered
- **THEN** the tooltip is positioned so it remains visible and doesn't extend off-screen

### Requirement: Tooltip styling is consistent with dashboard
The system SHALL style tooltips to match the overall dashboard design and be easily readable.

#### Scenario: Tooltip has appropriate contrast
- **WHEN** a tooltip is displayed
- **THEN** the text has sufficient contrast with the background to be easily readable

#### Scenario: Tooltip styling matches dashboard theme
- **WHEN** the dashboard is displayed
- **THEN** tooltips use colors and fonts consistent with the dashboard design
