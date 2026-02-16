## 1. Fix Sorting for SSH Host and Path Columns

- [x] 1.1 Update sort logic in Dashboard.js to handle computed columns (sshHost, workspacePath)
- [x] 1.2 Import or implement extractSSHHost and extractWorkspacePath functions in Dashboard.js
- [x] 1.3 Test sorting by SSH Host column
- [x] 1.4 Test sorting by Path column

## 2. Fix Column Resize Triggering Sort

- [x] 2.1 Add resizeCompleted flag to track when resize just finished
- [x] 2.2 Set flag in handleResizeEnd function
- [x] 2.3 Check flag in handleHeaderClick and skip sort if resize just completed
- [x] 2.4 Clear flag after short timeout (100ms) to allow normal sorting
- [x] 2.5 Test that resizing no longer triggers sorting

## 3. Add Column Visibility Toggle

- [x] 3.1 Add visibleColumns state to WorkspaceTable component
- [x] 3.2 Create column visibility dropdown UI with checkboxes
- [x] 3.3 Add toggle button in table header to open dropdown
- [x] 3.4 Implement column visibility toggle handler
- [x] 3.5 Update table rendering to respect visibleColumns state
- [x] 3.6 Ensure at least one column remains visible at all times
- [x] 3.7 Add CSS styling for column visibility dropdown
- [x] 3.8 Test showing/hiding each column

## 4. Testing and Verification

- [x] 4.1 Verify all sorting scenarios work correctly
- [x] 4.2 Verify resize no longer triggers sort
- [x] 4.3 Verify column visibility toggle works for all columns
- [x] 4.4 Verify table layout remains stable with hidden columns
- [x] 4.5 Test edge case: hide all but one column
