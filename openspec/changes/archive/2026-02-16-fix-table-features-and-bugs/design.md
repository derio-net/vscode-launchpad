## Context

The workspace table component (`WorkspaceTable.js`) currently has three usability issues:

1. **Sorting doesn't work for SSH Host and Path columns**: The current sorting logic in `Dashboard.js` only handles the raw workspace properties (`name`, `path`, `lastModified`, `type`), but SSH Host and Path are computed values extracted from the workspace path using `extractSSHHost()` and `extractWorkspacePath()` functions. When users click these column headers, the sort fails because these computed values don't exist on the workspace object itself.

2. **Column resize triggers sorting**: When users finish resizing a column by releasing the mouse button, the click event propagates to the header, triggering an unwanted sort operation. The current code tries to prevent this with `e.stopPropagation()` in `handleResizeStart`, but this doesn't stop the click event that fires on mouseup.

3. **No column visibility control**: All 6 columns are always visible, which can make the table crowded. Users need a way to show/hide columns based on their preferences.

## Goals / Non-Goals

**Goals:**
- Fix sorting for SSH Host and Path columns by using computed values
- Prevent sorting when finishing a column resize operation
- Add a column visibility toggle UI in the table header
- Maintain backward compatibility with existing functionality

**Non-Goals:**
- Persisting column visibility preferences to localStorage (can be added later)
- Adding new columns beyond the existing 6
- Changing the table styling significantly

## Decisions

### Decision: Use computed value sorting for derived columns

**Rationale**: SSH Host and Path are computed from the workspace path using regex extraction. To sort by these values, we need to compute them during the sort operation or maintain a cached computed dataset.

**Approach**: Modify the sort logic in `Dashboard.js` to handle computed columns by calling the extraction functions before comparison.

### Decision: Prevent sort on resize using a resize flag with timeout

**Rationale**: The current `isResizing` state doesn't prevent the click event that fires after mouseup. We need to track when a resize operation just completed and skip the next sort.

**Approach**: Set a flag when resize ends and check it in `handleHeaderClick`. Clear the flag after a short timeout (e.g., 100ms) to allow normal sorting afterward.

### Decision: Column visibility state managed in WorkspaceTable component

**Rationale**: Column visibility is a UI concern local to the table component. Keeping state in `WorkspaceTable` avoids prop drilling and keeps the Dashboard component clean.

**Approach**: Add a `visibleColumns` state object with boolean flags for each column. Render a dropdown menu in the table header for toggling visibility.

## Risks / Trade-offs

- **[Risk]** Column visibility state is lost on page refresh → **Mitigation**: Can add localStorage persistence in future iteration
- **[Risk]** Sorting by computed values may be slower for large datasets → **Mitigation**: Current workspace count is typically small (<1000), extraction functions are lightweight regex operations
- **[Risk]** Users may hide all columns → **Mitigation**: Ensure at least one column remains visible, or provide a reset option

## Migration Plan

No migration needed - these are additive changes and bug fixes. Existing functionality remains unchanged.

## Open Questions

None - all technical decisions are straightforward based on existing codebase patterns.
