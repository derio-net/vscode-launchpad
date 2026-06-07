# Delta: column-visibility-toggle

## MODIFIED Requirements

### Requirement: Users can toggle column visibility
The system SHALL provide a context menu, opened by right-clicking the table header row, that allows users to show or hide individual data columns.

#### Scenario: Context menu opens on header right-click
- **WHEN** a user right-clicks anywhere on the table header row
- **THEN** a context menu appears at the cursor position listing all data columns with checkboxes
- **AND** the native webview context menu is suppressed

#### Scenario: User hides a column
- **WHEN** a user unchecks a column in the context menu
- **THEN** that column is immediately hidden from the table view

#### Scenario: User shows a hidden column
- **WHEN** a user checks a previously hidden column in the context menu
- **THEN** that column is immediately shown in the table view

#### Scenario: Name column cannot be hidden
- **WHEN** a user views the context menu
- **THEN** the Name column's checkbox is checked and disabled with a locked indication, and the Name column cannot be hidden

#### Scenario: Select column is excluded from the menu
- **WHEN** a user opens the context menu
- **THEN** the structural selection checkbox column does not appear as a menu entry

#### Scenario: Context menu closes on dismissal
- **WHEN** a user clicks outside the open context menu or presses Escape
- **THEN** the context menu closes

#### Scenario: No standalone column visibility button
- **WHEN** a user views the workspace table
- **THEN** no "Columns" dropdown button is rendered; the context menu is the only column visibility control

### Requirement: Column visibility state is tracked
The system SHALL persist the visibility state of each column across sessions and restore it when the application is reopened.

#### Scenario: Column visibility persists across sessions
- **WHEN** a user toggles column visibility and restarts the application
- **THEN** the column visibility settings are restored, except that the Name column is always forced visible

#### Scenario: Persisted Claude visibility choice wins over auto-show
- **WHEN** a user has explicitly toggled the Claude column's visibility in a previous session and Claude Code hooks become configured
- **THEN** the user's persisted choice is respected and auto-show does NOT override it

#### Scenario: Claude column auto-shows when never explicitly toggled
- **WHEN** the user has never explicitly toggled the Claude column and Claude Code hooks become configured
- **THEN** the Claude column is automatically shown
