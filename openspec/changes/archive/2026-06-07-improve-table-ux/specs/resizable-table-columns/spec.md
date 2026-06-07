# Delta: resizable-table-columns

## MODIFIED Requirements

### Requirement: Users can resize table columns
The system SHALL allow users to resize table columns by dragging the handle between two column headers, trading width only between that adjacent pair of visible columns, with column widths persisting across sessions.

#### Scenario: User resizes column by dragging border
- **WHEN** a user positions the cursor on the resize handle between two column headers
- **THEN** the cursor changes to indicate the column is resizable

#### Scenario: Resizing trades width only between the adjacent pair
- **WHEN** a user drags a resize handle to the right or left
- **THEN** the column left of the handle grows or shrinks by the drag amount and the next visible column shrinks or grows by the same amount
- **AND** all other columns retain their widths and the total table width is unchanged

#### Scenario: Hidden columns are skipped when determining the pair
- **WHEN** the column immediately right of the dragged handle is hidden
- **THEN** the resize trades width with the next visible column instead

#### Scenario: Last visible column has no resize handle
- **WHEN** a user views the header of the last visible column
- **THEN** no resize handle is rendered on it, as there is no adjacent column to trade width with

#### Scenario: Column widths persist across sessions
- **WHEN** a user resizes columns and restarts the application
- **THEN** the column widths are restored to the user's previous settings when the dashboard is reopened

#### Scenario: User can reset column layout to defaults
- **WHEN** a user selects "Reset columns" in the header context menu
- **THEN** all column widths, order, and visibility return to their default values

#### Scenario: Resizing does not trigger column sorting
- **WHEN** a user finishes resizing a column by releasing the mouse button
- **THEN** the column is NOT sorted; only the resize operation completes

### Requirement: Resizable columns maintain table structure
The system SHALL maintain proper table layout and readability when columns are resized, preventing columns from becoming too narrow or too wide.

#### Scenario: Minimum column width is enforced on both columns of the pair
- **WHEN** a user drags a resize handle such that either column of the adjacent pair would drop below the minimum width (100px)
- **THEN** the drag is clamped so that neither column goes below the minimum width

#### Scenario: Table remains responsive
- **WHEN** columns are resized to various widths
- **THEN** the table remains properly formatted and readable on different screen sizes
