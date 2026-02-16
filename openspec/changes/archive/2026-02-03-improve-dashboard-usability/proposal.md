## Why

The dashboard table lacks important usability features that would improve the user experience. Users cannot resize columns to focus on relevant information, and the table doesn't display detailed workspace attributes (SSH host, remote path) that are essential for distinguishing between similar workspaces. These improvements will make the dashboard more practical for users managing multiple workspaces across different environments.

## What Changes

- Add resizable column widths to the dashboard table, allowing users to adjust column sizes based on their needs
- Add new columns to display workspace-specific attributes:
  - **SSH Host**: For SSH remote workspaces, display the SSH host/alias
  - **Path**: For all workspace types, display the workspace path (local path for local/dev containers, remote path for SSH remotes)
- Parse and extract SSH host information from remote workspace URIs
- Leave attributes empty if not applicable to the workspace type
- Maintain existing columns (Name, Type, Last Modified)
- Change the default application port from 3000 to 3010 to avoid conflicts with other local applications

## Capabilities

### New Capabilities
- `resizable-table-columns`: Enable users to resize dashboard table columns by dragging column borders
- `workspace-attributes-display`: Display detailed workspace attributes (SSH Host, Path) based on workspace type

### Modified Capabilities
- `basic-view-dashboard`: Update table structure to include new columns and resizable functionality

## Impact

- **Frontend**: [`WorkspaceTable.js`](src/components/WorkspaceTable.js), [`WorkspaceTable.css`](src/components/WorkspaceTable.css) - Table structure, styling, and column handling
- **Backend**: [`server/index.js`](server/index.js) - Change default port from 3000 to 3010
- **Configuration**: Environment variables and documentation may reference port 3000
- **User Experience**: Improved visibility of workspace details, better control over table layout, and reduced port conflicts
