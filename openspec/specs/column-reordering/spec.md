# column-reordering Specification

## Purpose
Defines how users reposition workspace table columns: drag-to-reorder on column headers (disambiguated from sort clicks by a movement threshold), drag handles in the header context menu, and persistence of the chosen order across sessions.

## Requirements
### Requirement: Users can reorder columns by dragging headers
The system SHALL allow users to reposition table columns by pressing and dragging a column header horizontally, with a movement threshold distinguishing reorder drags from sort clicks.

#### Scenario: Click and release sorts, does not reorder
- **WHEN** a user presses the left mouse button on a column header and releases it having moved the cursor less than the drag threshold (~5px)
- **THEN** the table is sorted by that column and no reorder occurs

#### Scenario: Press and move enters drag mode
- **WHEN** a user presses the left mouse button on a column header and moves the cursor at least the drag threshold (~5px)
- **THEN** the header enters drag mode with a visual lifted indication and no sort is triggered on release

#### Scenario: Columns live-swap during drag
- **WHEN** a dragged header's cursor crosses the horizontal midpoint of an adjacent visible column header
- **THEN** the two columns immediately exchange positions in both the header and the body rows

#### Scenario: Completed drag commits the new order
- **WHEN** a user releases the mouse after dragging a header to a new position
- **THEN** the column order is committed and persisted, and the release does NOT trigger a sort

#### Scenario: Select column is pinned
- **WHEN** a user attempts to drag the selection checkbox column, or to drop another column before it
- **THEN** the selection column remains at the first position and the drop is not permitted

#### Scenario: Reordering does not conflict with resizing
- **WHEN** a user presses the mouse on a column's resize handle
- **THEN** a resize gesture begins and no reorder drag is initiated

### Requirement: Users can reorder columns from the header context menu
The system SHALL list columns in the header context menu in their current display order and SHALL allow reordering them via drag handles on the menu items.

#### Scenario: Menu order mirrors column order
- **WHEN** a user opens the header context menu
- **THEN** the column entries appear in the same order as the columns in the table

#### Scenario: Dragging a menu item reorders the column
- **WHEN** a user drags a menu item's drag handle above or below another menu item
- **THEN** the corresponding columns exchange positions in the table immediately

#### Scenario: Hidden columns can be reordered from the menu
- **WHEN** a user drags the menu item of a currently hidden column to a new position
- **THEN** the column's position is updated so that it appears at that position when later made visible

### Requirement: Column order persists across sessions
The system SHALL persist the column order and restore it when the application is reopened.

#### Scenario: Order is restored on reload
- **WHEN** a user reorders columns and restarts the application
- **THEN** the columns appear in the user's chosen order

#### Scenario: Unknown or missing columns are reconciled on load
- **WHEN** the persisted order contains unknown column keys or is missing newly added columns
- **THEN** unknown keys are dropped and missing columns are appended at their default positions
