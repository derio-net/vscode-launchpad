# Design: Open Workspace from Dashboard

## Context

The VS Code Workspace Dashboard currently displays workspace information in a read-only table format. Users can view workspace names, paths, and metadata, but cannot interact with workspaces directly from the dashboard. This requires users to manually navigate to VS Code and open workspaces through the File menu or command palette.

The current architecture consists of:
- **Backend**: Node.js/Express server that scans VS Code workspace storage and exposes workspace data via REST API
- **Frontend**: React-based dashboard that displays workspace information in a sortable, filterable table
- **Data Flow**: Server reads workspace JSON files → API endpoint returns workspace list → Frontend renders table

Constraints:
- The dashboard runs on localhost and should not require elevated permissions
- VS Code may or may not be running when a user clicks a workspace
- Multiple VS Code windows may be open simultaneously
- The solution must work across different workspace types (local folders, .code-workspace files, remote workspaces)

## Goals / Non-Goals

**Goals:**
- Enable users to open workspaces in VS Code directly from the dashboard with a single click
- Detect if a workspace is already open and focus that window instead of opening a duplicate
- Display full file paths as tooltips when hovering over workspace names
- Provide clear visual feedback that workspace entries are clickable
- Maintain compatibility with all supported workspace formats (local, remote, dev containers)

**Non-Goals:**
- Detecting which specific VS Code window has a workspace open (we'll rely on VS Code's built-in behavior)
- Supporting other editors besides VS Code
- Modifying workspace settings or metadata
- Real-time synchronization of open/closed workspace state

## Decisions

### Decision 1: Use VS Code URI Scheme for Opening Workspaces

**Choice**: Use the `vscode://` URI scheme to open workspaces.

**Rationale**: 
- VS Code registers the `vscode://` protocol handler on installation
- The URI scheme `vscode://file/<path>` opens a folder or workspace file
- VS Code automatically handles duplicate detection - if a workspace is already open, it focuses that window
- Works across platforms (macOS, Windows, Linux) without additional dependencies
- No need for backend API changes - the frontend can construct URIs directly from workspace data

**Alternatives Considered**:
- **CLI approach** (`code <path>`): Would require backend endpoint to execute shell commands, raising security concerns and requiring the `code` CLI to be in PATH
- **VS Code Extension API**: Would require building a companion extension, adding complexity and installation requirements
- **Custom protocol handler**: Would require additional installation steps and platform-specific implementations

### Decision 2: Frontend-Only Implementation for Workspace Opening

**Choice**: Implement workspace opening entirely in the frontend using anchor tags with `vscode://` URIs. Make sure to handle long paths by showing full path on hover, ideally splitting into multiple lines if needed.

**Rationale**:
- No backend changes required - workspace paths are already available in the API response
- Simpler architecture with fewer moving parts
- Better performance - no round-trip to server needed
- Browser handles protocol invocation natively

**Implementation Details**:
- Convert workspace paths from the API response to `vscode://` URIs
- Handle different workspace formats:
  - Local folders: `vscode://file/<absolute-path>`
  - Workspace files (.code-workspace): `vscode://file/<absolute-path-to-workspace-file>`
  - Remote workspaces: Use existing `vscode-remote://` scheme from workspace data
- Use anchor tags (`<a href="vscode://...">`) for accessibility and standard browser behavior

### Decision 3: CSS-Based Tooltips for File Paths

**Choice**: Use native HTML `title` attribute for tooltips initially, with option to enhance with CSS tooltips later.

**Rationale**:
- `title` attribute provides immediate functionality with zero implementation cost
- Works across all browsers without JavaScript
- Accessible by default (screen readers announce title text)
- Can be enhanced later with custom CSS tooltips if more control is needed (positioning, styling, delay)

**Alternatives Considered**:
- **Third-party tooltip library**: Adds dependency and bundle size for minimal benefit
- **Custom JavaScript tooltips**: More complex, requires state management and event handling
- **CSS-only custom tooltips**: Better styling control but requires more implementation time

### Decision 4: Visual Feedback for Clickable Entries

**Choice**: Style workspace names as links with hover effects and cursor changes.

**Rationale**:
- Users expect links to be underlined or colored differently
- Hover effects (color change, underline) provide immediate feedback
- Cursor change to pointer indicates clickability
- Maintains consistency with web conventions

**Implementation**:
- Apply link styling to workspace name cells
- Add hover state with color transition
- Include visual indicator (e.g., external link icon) to show action opens external application

## Risks / Trade-offs

### Risk: VS Code Not Installed or Protocol Handler Not Registered
**Impact**: Clicking a workspace link will fail silently or show browser error.

**Mitigation**: 
- Add informational text near the dashboard explaining that VS Code must be installed
- Consider adding a "Test" button that attempts to open VS Code and reports success/failure
- Future enhancement: Detect if protocol handler is registered and show warning if not

### Risk: Path Encoding Issues
**Impact**: Workspaces with special characters in paths may not open correctly.

**Mitigation**:
- Properly URL-encode paths when constructing `vscode://` URIs
- Test with workspaces containing spaces, special characters, and Unicode characters
- Handle edge cases like network paths on Windows

### Risk: Remote Workspace URI Format Differences
**Impact**: Remote workspaces (SSH, containers) may have different URI formats that don't work with simple `vscode://file/` prefix.

**Mitigation**:
- Preserve existing `vscode-remote://` URIs from workspace data without modification
- Add logic to detect workspace type and construct appropriate URI
- Test with dev containers, SSH remotes, and WSL workspaces

### Trade-off: No Visual Indication of Already-Open Workspaces
**Impact**: Users won't know if a workspace is already open before clicking.

**Rationale**: 
- Detecting open workspaces would require VS Code extension or complex process inspection
- VS Code handles this gracefully by focusing existing windows
- The user experience is still good - clicking always results in the workspace being available
- Future enhancement could add this if user feedback indicates it's valuable

### Trade-off: Browser Security Warnings
**Impact**: Some browsers may show security warnings when opening custom protocol handlers.

**Mitigation**:
- This is expected behavior for external protocol handlers
- Users will typically see a one-time "Allow" dialog
- Document this in README or help text
- Consider adding a "Remember my choice" note in the UI

## Migration Plan

**Phase 1: Frontend Changes**
1. Update [`WorkspaceTable.js`](src/components/WorkspaceTable.js) to render workspace names as clickable links
2. Add function to convert workspace paths to `vscode://` URIs
3. Add `title` attribute with full path for tooltip functionality
4. Update [`WorkspaceTable.css`](src/components/WorkspaceTable.css) with link styling and hover effects

**Phase 2: Testing**
1. Test with local folder workspaces
2. Test with .code-workspace files
3. Test with remote workspaces (SSH, containers)
4. Test with workspaces containing special characters
5. Verify tooltip display on hover
6. Test on macOS, Windows, and Linux

**Phase 3: Documentation**
1. Update README with new functionality
2. Add note about VS Code installation requirement
3. Document browser compatibility and security warnings

**Rollback Strategy**:
- Changes are purely additive in the frontend
- If issues arise, can quickly revert to displaying workspace names as plain text
- No database migrations or backend changes to roll back

## Open Questions

1. **Should we add a visual indicator (icon) to show that clicking opens an external application?**
   - Leaning yes - helps set user expectations -> YES
   - Could use an external link icon or VS Code logo -> YES

2. **Should we add a context menu with additional actions (copy path, reveal in Finder/Explorer)?**
   - Not in initial implementation (keeping scope focused) -> NO
   - Good candidate for future enhancement

3. **How should we handle workspace files that no longer exist on disk?**
   - Current behavior: They still appear in the dashboard (stale data)
   - Opening them will fail - VS Code will show error
   - Could add validation in backend to check file existence (future enhancement)
