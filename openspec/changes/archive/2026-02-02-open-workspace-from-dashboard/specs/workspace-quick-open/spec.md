# workspace-quick-open Specification

## Purpose
Enable users to open workspaces directly from the dashboard by clicking on workspace entries, with VS Code automatically handling window focus or creation.

## Requirements

### Requirement: Click workspace to open in VS Code
The system SHALL allow users to click on a workspace entry in the dashboard to open that workspace in VS Code.

#### Scenario: User clicks on a workspace name
- **WHEN** a user clicks on a workspace name in the dashboard table
- **THEN** VS Code opens with that workspace folder loaded

#### Scenario: Workspace file is opened instead of folder
- **WHEN** a user clicks on a workspace that is defined as a .code-workspace file
- **THEN** VS Code opens with that workspace file loaded

#### Scenario: Remote workspace is opened
- **WHEN** a user clicks on a remote workspace (SSH, dev container, etc.)
- **THEN** VS Code opens with the remote connection established to that workspace

### Requirement: Focus existing VS Code window if workspace already open
The system SHALL detect if a workspace is already open in VS Code and focus that window instead of opening a duplicate.

#### Scenario: Workspace is already open
- **WHEN** a user clicks on a workspace that is already open in an existing VS Code window
- **THEN** VS Code focuses the existing window containing that workspace

#### Scenario: Multiple VS Code windows are open
- **WHEN** multiple VS Code windows are open and user clicks a workspace
- **THEN** VS Code focuses the window containing that workspace, or opens a new window if not found

### Requirement: Handle special characters in workspace paths
The system SHALL properly encode workspace paths with special characters (spaces, symbols, Unicode) when constructing VS Code URIs.

#### Scenario: Workspace path contains spaces
- **WHEN** a workspace path contains spaces (e.g., `/Users/name/My Projects/workspace`)
- **THEN** the path is properly URL-encoded and VS Code opens the workspace correctly

#### Scenario: Workspace path contains special characters
- **WHEN** a workspace path contains special characters (e.g., `@`, `#`, `&`)
- **THEN** the path is properly URL-encoded and VS Code opens the workspace correctly

### Requirement: Provide visual feedback for clickable workspaces
The system SHALL indicate that workspace entries are clickable through visual styling.

#### Scenario: Workspace name appears as a link
- **WHEN** the dashboard is displayed
- **THEN** workspace names are styled to appear as clickable links (e.g., underlined, colored)

#### Scenario: Hover effect on workspace name
- **WHEN** a user hovers over a workspace name
- **THEN** the cursor changes to a pointer and the link styling changes (e.g., color change, underline)

#### Scenario: Visual indicator of external action
- **WHEN** the dashboard is displayed
- **THEN** workspace names include a visual indicator (e.g., external link icon) showing that clicking opens an external application

### Requirement: Handle VS Code not installed or protocol handler not registered
The system SHALL gracefully handle cases where VS Code is not installed or the protocol handler is not registered.

#### Scenario: VS Code protocol handler is not available
- **WHEN** a user clicks on a workspace and VS Code protocol handler is not registered
- **THEN** the browser shows an appropriate error or warning message

#### Scenario: User is informed about requirement
- **WHEN** the dashboard is displayed
- **THEN** informational text indicates that VS Code must be installed for workspace opening to work
