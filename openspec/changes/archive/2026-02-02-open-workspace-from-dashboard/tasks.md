# Tasks: Open Workspace from Dashboard

## 1. Frontend - Workspace Quick Open Implementation

- [x] 1.1 Create utility function to convert workspace paths to `vscode://` URIs
- [x] 1.2 Handle different workspace types (local folders, .code-workspace files, remote workspaces)
- [x] 1.3 Implement proper URL encoding for paths with special characters
- [x] 1.4 Update [`WorkspaceTable.js`](src/components/WorkspaceTable.js) to render workspace names as clickable links
- [x] 1.5 Add `href` attribute with `vscode://` URI to workspace name cells
- [x] 1.6 Add `title` attribute with full file path for tooltip functionality
- [x] 1.7 Test workspace opening with local folder workspaces
- [ ] 1.8 Test workspace opening with .code-workspace files
- [x] 1.9 Test workspace opening with remote workspaces (SSH, dev containers)

## 2. Frontend - Visual Styling and Feedback

- [x] 2.1 Update [`WorkspaceTable.css`](src/components/WorkspaceTable.css) to style workspace names as links
- [x] 2.2 Add underline or color styling to indicate clickability
- [x] 2.3 Add hover state with cursor pointer and color change
- [x] 2.4 Add external link icon or visual indicator next to workspace names
- [x] 2.5 Ensure tooltip styling is consistent with dashboard theme
- [x] 2.6 Test visual feedback on hover across different browsers
- [x] 2.7 Verify accessibility of link styling (sufficient color contrast)

## 3. Frontend - Tooltip Implementation

- [x] 3.1 Verify native HTML `title` attribute tooltips work correctly
- [x] 3.2 Test tooltip display on hover for various path lengths
- [x] 3.3 Test tooltip positioning for workspaces near screen edges
- [x] 3.4 Verify tooltip accessibility with screen readers
- [x] 3.5 Test keyboard navigation to workspace names and tooltip display
- [ ] 3.6 Consider CSS tooltip enhancement if native tooltips are insufficient

## 4. Frontend - User Guidance

- [x] 4.1 Add informational text to dashboard indicating VS Code must be installed
- [x] 4.2 Add note about browser security warnings for protocol handlers
- [ ] 4.3 Consider adding a "Test" button to verify VS Code protocol handler availability
- [x] 4.4 Update dashboard header or footer with usage instructions

## 5. Testing and Validation

- [x] 5.1 Test workspace opening on macOS
- [ ] 5.2 Test workspace opening on Windows
- [ ] 5.3 Test workspace opening on Linux
- [ ] 5.4 Test with workspaces containing spaces in paths
- [ ] 5.5 Test with workspaces containing special characters (@, #, &, etc.)
- [ ] 5.6 Test with workspaces containing Unicode characters
- [ ] 5.7 Test with very long file paths
- [x] 5.8 Test with VS Code not installed (graceful error handling)
- [ ] 5.9 Test with multiple VS Code windows open
- [x] 5.10 Verify existing workspace functionality still works (search, filter, sort)

## 6. Documentation and Deployment

- [x] 6.1 Update README with new workspace opening functionality
- [x] 6.2 Document browser compatibility and known limitations
- [x] 6.3 Add troubleshooting section for common issues
- [x] 6.4 Build production bundle with changes
- [x] 6.5 Test production build functionality
- [ ] 6.6 Deploy changes to production
