# Proposal: Open Workspace from Dashboard

## Why

Users currently view workspaces in the dashboard but must manually navigate to VS Code and open the workspace folder. This creates friction in the workflow. Additionally, users cannot easily identify the exact file path when hovering over workspace names, leading to confusion about workspace locations. By enabling direct workspace opening from the dashboard and providing path tooltips, we streamline the user experience and reduce context switching.

## What Changes

- Add clickable links to workspace entries that trigger VS Code to open the workspace folder
- Implement logic to detect if a workspace is already open in VS Code and focus that window, or open a new VS Code window if not
- Add tooltip functionality that displays the full file path when users hover over workspace names
- Enhance the dashboard UI to provide visual feedback for clickable workspace entries

## Capabilities

### New Capabilities
- `workspace-quick-open`: Ability to click on a workspace in the dashboard and open it in VS Code (either focusing existing window or opening new window)
- `file-path-tooltip`: Display full file path as a tooltip when hovering over workspace names in the dashboard

### Modified Capabilities
- `basic-view-dashboard`: Extend the dashboard to support interactive workspace opening and path tooltips

## Impact

- **Frontend**: Dashboard component will need click handlers and tooltip UI elements
- **Backend**: May need new API endpoint or enhanced existing endpoint to support workspace opening logic
- **User Experience**: Significant improvement in workflow efficiency and clarity
- **Dependencies**: May require integration with VS Code's URI scheme (`vscode://`) or command-line interface
