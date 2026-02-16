# Implementation Tasks: improve-dashboard-usability

## 1. Add Attribute Extraction Utilities

- [x] 1.1 Create utility functions to extract SSH host from remote workspace URIs
- [x] 1.2 Create utility functions to extract workspace path from all URI types
- [x] 1.3 Add unit tests for URI parsing functions with various URI formats
- [x] 1.4 Handle edge cases (malformed URIs, missing components)

## 2. Update Table Structure

- [x] 2.1 Add "SSH Host" and "Path" columns to the table in [`WorkspaceTable.js`](src/components/WorkspaceTable.js)
- [x] 2.2 Update table header to include new columns
- [x] 2.3 Populate SSH Host column using extraction utility
- [x] 2.4 Populate Path column using extraction utility
- [x] 2.5 Ensure empty cells display correctly for non-applicable attributes

## 3. Implement Column Resizing

- [x] 3.1 Add CSS for resizable columns in [`WorkspaceTable.css`](src/components/WorkspaceTable.css)
- [x] 3.2 Implement JavaScript event handlers for column resize (mousedown, mousemove, mouseup)
- [x] 3.3 Add localStorage persistence for column widths
- [x] 3.4 Implement minimum column width constraints
- [x] 3.5 Add visual indicator (cursor change) when hovering over column borders

## 4. Add Reset Functionality

- [x] 4.1 Add "Reset Columns" button or control to the dashboard
- [x] 4.2 Implement reset function to restore default column widths
- [x] 4.3 Clear localStorage when reset is triggered

## 5. Testing and Verification

- [x] 5.1 Test SSH Host extraction for various SSH remote URI formats
- [x] 5.2 Test Path extraction for local, SSH remote, dev container, and attached container workspaces
- [x] 5.3 Test column resizing with mouse drag operations
- [x] 5.4 Test column width persistence across page reloads
- [x] 5.5 Test reset functionality
- [x] 5.6 Test table layout with various column width combinations
- [x] 5.7 Verify responsive design on different screen sizes
- [x] 5.8 Test with malformed or edge-case URIs

## 6. Change Default Port

- [x] 6.1 Update default port from 3000 to 3010 in [`server/index.js`](server/index.js)
- [x] 6.2 Update environment variable defaults if applicable
- [x] 6.3 Update documentation and README to reference port 3010
- [x] 6.4 Test application starts on port 3010

## 7. Documentation and Cleanup

- [x] 7.1 Update code comments in [`WorkspaceTable.js`](src/components/WorkspaceTable.js) to explain new columns and resizing
- [x] 7.2 Update CSS comments in [`WorkspaceTable.css`](src/components/WorkspaceTable.css) for resizable column styles
- [x] 7.3 Verify no console errors or warnings
- [x] 7.4 Build and test the application
