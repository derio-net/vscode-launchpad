# column-visibility-toggle Specification

## Purpose
TBD - created by archiving change fix-table-features-and-bugs. Update Purpose after archive.
## Requirements
### Requirement: Users can toggle column visibility
The system SHALL provide a UI control that allows users to show or hide individual table columns.

#### Scenario: Column visibility menu is accessible
- **WHEN** a user views the workspace table
- **THEN** a column visibility toggle button is visible in the table header area

#### Scenario: User opens column visibility dropdown
- **WHEN** a user clicks the column visibility toggle button
- **THEN** a dropdown menu appears showing all available columns with checkboxes

#### Scenario: User hides a column
- **WHEN** a user unchecks a column in the visibility dropdown
- **THEN** that column is immediately hidden from the table view

#### Scenario: User shows a hidden column
- **WHEN** a user checks a previously hidden column in the visibility dropdown
- **THEN** that column is immediately shown in the table view

#### Scenario: At least one column remains visible
- **WHEN** a user attempts to hide all columns
- **THEN** the last visible column cannot be hidden, or a default column remains visible

### Requirement: Column visibility state is tracked
The system SHALL maintain the visibility state of each column during the user session.

#### Scenario: Column visibility persists during session
- **WHEN** a user toggles column visibility and continues using the dashboard
- **THEN** the column visibility settings remain applied until the page is refreshed

