## Why

The workspace table has several usability issues that degrade the user experience: sorting doesn't work correctly for SSH Host and Path columns, column resizing accidentally triggers sorting, and users cannot customize which columns are visible. These issues make the dashboard harder to use and need to be addressed to improve overall functionality.

## What Changes

- **Fix sorting for SSH Host and Path columns**: Ensure proper sorting behavior for all column types
- **Prevent sorting on column resize**: Stop propagation of click events when finishing a column resize operation
- **Add column visibility toggle**: Allow users to show/hide columns via a dropdown menu in the table header

## Capabilities

### New Capabilities
- `column-visibility-toggle`: UI control to show/hide table columns with state persistence

### Modified Capabilities
- `resizable-table-columns`: Add requirement to prevent sorting trigger on resize completion
- `basic-view-dashboard`: Add requirement for proper sorting on SSH Host and Path columns

## Impact

- Affected files: `src/components/WorkspaceTable.js`, `src/components/WorkspaceTable.css`
- No breaking changes to existing APIs or data structures
- Column visibility preferences will be stored in component state (potential for localStorage persistence in future)
