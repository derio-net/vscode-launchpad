# expandable-cell-content Specification

## Purpose
Defines the click-to-expand behavior for truncated workspace table cells (Path, Full Path, Connection): in-place expansion with wrapped text and a copy-to-clipboard button for the full value.

## Requirements
### Requirement: Users can expand truncated cells to view full content
The system SHALL allow users to click a truncated cell in an expandable column (Path, Full Path, Connection) to display its full content in place with wrapped text.

#### Scenario: Clicking a truncated cell expands it
- **WHEN** a user clicks a cell in an expandable column
- **THEN** the cell expands in place, showing the full value with wrapped text instead of an ellipsis

#### Scenario: Clicking an expanded cell collapses it
- **WHEN** a user clicks a cell that is currently expanded
- **THEN** the cell collapses back to its truncated single-line display

#### Scenario: Only one cell is expanded at a time
- **WHEN** a user clicks an expandable cell while another cell is expanded
- **THEN** the previously expanded cell collapses and the clicked cell expands

#### Scenario: Non-expandable columns are unaffected
- **WHEN** a user clicks a cell in a non-expandable column (e.g., Name, Type)
- **THEN** the cell's existing behavior applies and no expansion occurs

### Requirement: Expanded cells provide a copy-to-clipboard button
The system SHALL display a copy button inside an expanded cell that copies the cell's full value to the system clipboard.

#### Scenario: Copy button copies the full value
- **WHEN** a user clicks the copy button in an expanded cell
- **THEN** the cell's full untruncated value is written to the system clipboard
- **AND** a transient confirmation indicator is shown

#### Scenario: Copy button does not collapse the cell
- **WHEN** a user clicks the copy button
- **THEN** the cell remains expanded

#### Scenario: Clipboard API unavailable
- **WHEN** the clipboard API is not available in the current context
- **THEN** the copy button is not rendered and the expanded cell still shows the full wrapped value
