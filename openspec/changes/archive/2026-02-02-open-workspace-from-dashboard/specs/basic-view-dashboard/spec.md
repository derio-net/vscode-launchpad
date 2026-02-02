# basic-view-dashboard Specification - Delta

## MODIFIED Requirements

### Requirement: Display dashboard UI
The system SHALL serve a web-based dashboard that displays all workspaces in a user-friendly format with interactive features for opening workspaces and viewing full paths.

#### Scenario: Dashboard loads successfully
- **WHEN** a user navigates to http://localhost:3000
- **THEN** the dashboard UI loads and displays a list of all workspaces

#### Scenario: Dashboard displays workspace information
- **WHEN** the dashboard is loaded
- **THEN** each workspace is displayed with its name, path, and last modified date in a sortable table

#### Scenario: Workspace names are clickable
- **WHEN** the dashboard is loaded
- **THEN** workspace names are styled as clickable links with visual indicators (underline, color, icon)

#### Scenario: Workspace names open in VS Code on click
- **WHEN** a user clicks on a workspace name
- **THEN** VS Code opens with that workspace loaded (or focuses existing window if already open)

#### Scenario: Full path is displayed on hover
- **WHEN** a user hovers over a workspace name
- **THEN** a tooltip appears displaying the full file path of that workspace

#### Scenario: Tooltip remains visible during hover
- **WHEN** a user hovers over a workspace name and a tooltip is displayed
- **THEN** the tooltip remains visible while the cursor is over the workspace name

#### Scenario: Tooltip disappears on mouse leave
- **WHEN** a user moves the cursor away from a workspace name
- **THEN** the tooltip disappears

#### Scenario: Visual feedback on hover
- **WHEN** a user hovers over a workspace name
- **THEN** the cursor changes to a pointer and link styling changes (e.g., color change)

#### Scenario: Dashboard indicates VS Code requirement
- **WHEN** the dashboard is displayed
- **THEN** informational text indicates that VS Code must be installed for workspace opening to work
