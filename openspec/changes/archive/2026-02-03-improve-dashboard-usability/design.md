## Context

The current dashboard table displays workspaces with four columns: Name, Last Modified, Type, and Path. However, the Path column shows the full URI for all workspace types, making it difficult to distinguish between similar workspaces. Additionally, users cannot resize columns to focus on information relevant to their workflow. For SSH remote workspaces, the SSH host information is embedded in the URI but not easily visible.

The table is implemented in [`WorkspaceTable.js`](src/components/WorkspaceTable.js) using standard HTML table elements with CSS styling in [`WorkspaceTable.css`](src/components/WorkspaceTable.css).

## Goals / Non-Goals

**Goals:**
- Enable users to resize table columns by dragging column borders
- Display SSH host information separately for SSH remote workspaces
- Show workspace paths clearly for all workspace types
- Improve table usability without breaking existing functionality
- Maintain responsive design and accessibility

**Non-Goals:**
- Add column sorting/reordering functionality
- Implement column visibility toggles
- Change the overall dashboard layout or styling theme
- Modify backend workspace scanning logic

## Decisions

**Decision 1: Column resizing implementation**
- **Choice**: Use CSS `resize` property on table cells with JavaScript event handlers to track and persist column widths
- **Rationale**: Lightweight solution that doesn't require external libraries. Column widths can be stored in localStorage for persistence across sessions.
- **Alternative considered**: Use a library like `react-resizable-columns`. Rejected to avoid adding dependencies for a simple feature.

**Decision 2: Attribute extraction approach**
- **Choice**: Parse workspace URIs in the frontend to extract SSH host and path information
- **Rationale**: Keeps attribute extraction logic in the presentation layer where it's used. The backend already provides the full URI; frontend can parse it.
- **Alternative considered**: Have backend extract and return attributes separately. Rejected as it would require backend changes and duplication of parsing logic.

**Decision 3: Column structure**
- **Choice**: Replace the single "Path" column with two columns: "SSH Host" (for remote workspaces) and "Path"
- **Rationale**: Separates concerns and makes SSH host information immediately visible without parsing the full URI
- **Alternative considered**: Keep single Path column and show parsed attributes in tooltips. Rejected as it reduces discoverability.

**Decision 4: Handling missing attributes**
- **Choice**: Display empty string for attributes not applicable to workspace type
- **Rationale**: Consistent, clean appearance. Users understand that empty cells mean the attribute doesn't apply.
- **Alternative considered**: Show placeholder text like "N/A". Rejected as it adds visual clutter.

## Risks / Trade-offs

**Risk: Column width persistence**
- **Mitigation**: Store column widths in localStorage with a version key to handle schema changes. Provide reset button to restore defaults.

**Risk: URI parsing complexity**
- **Mitigation**: Create utility functions to extract SSH host and path from different URI formats. Add unit tests for edge cases.

**Risk: Table layout issues with resizable columns**
- **Mitigation**: Use CSS `table-layout: fixed` to prevent column width changes from affecting table structure. Test with various column width combinations.

**Trade-off: Added complexity vs. improved UX**
- **Rationale**: The added complexity is minimal (parsing logic + resize handlers) and provides significant UX improvement for users managing many workspaces.

## Migration Plan

1. Add new columns to table structure (SSH Host, Path)
2. Implement URI parsing functions to extract attributes
3. Add CSS for resizable columns
4. Add JavaScript event handlers for column resizing
5. Test with various workspace types and URI formats
6. Deploy and monitor for any layout issues

**Rollback**: Remove new columns and resize functionality, revert to original table structure.
