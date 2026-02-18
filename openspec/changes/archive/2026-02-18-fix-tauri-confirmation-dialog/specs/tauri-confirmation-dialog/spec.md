## ADDED Requirements

### Requirement: Tauri dialog plugin dependency
The system SHALL include `tauri-plugin-dialog` as a dependency in the Tauri application.

#### Scenario: Plugin dependency is declared
- **WHEN** the Tauri application is built
- **THEN** `tauri-plugin-dialog` with version "2" SHALL be listed in `src-tauri/Cargo.toml` dependencies
- **AND** the plugin SHALL be compatible with Tauri v2.x

### Requirement: Dialog plugin initialization
The system SHALL initialize the dialog plugin during Tauri application startup.

#### Scenario: Plugin is initialized on startup
- **WHEN** the Tauri application starts
- **THEN** the dialog plugin SHALL be registered with the Tauri builder
- **AND** the plugin SHALL be available for frontend invocation

#### Scenario: Plugin initialization code
- **WHEN** examining `src-tauri/src/lib.rs`
- **THEN** the `run()` function SHALL include `.plugin(tauri_plugin_dialog::init())`
- **AND** the plugin SHALL be chained with other plugin initializations

### Requirement: Dialog permissions configuration
The system SHALL configure permissions to allow the frontend to invoke dialog commands.

#### Scenario: Dialog permission is granted
- **WHEN** the frontend calls the dialog API
- **THEN** the `dialog:allow-ask` permission SHALL be present in `src-tauri/capabilities/default.json`
- **AND** the permission SHALL allow the "main" window to show confirmation dialogs

### Requirement: Frontend dialog API integration
The system SHALL replace `window.confirm()` with Tauri's `ask()` API in the workspace deletion flow.

#### Scenario: Import Tauri dialog API
- **WHEN** the Dashboard component loads
- **THEN** the component SHALL import `ask` from `@tauri-apps/plugin-dialog`
- **AND** the import SHALL be at the top of `src/components/Dashboard.js`

#### Scenario: Replace confirm with ask
- **WHEN** a user clicks the delete button and workspaces are selected
- **THEN** the system SHALL call `ask()` instead of `window.confirm()`
- **AND** the dialog message SHALL match the existing message format:
  ```
  Are you sure you want to delete {N} workspace(s) from your Path?

  This will remove the following workspace references:
    - {workspace_name_1}
    - {workspace_name_2}
    ...

  Note: This only removes the workspace reference from VS Code:'s history. Your actual project files will NOT be deleted.
  ```

#### Scenario: Dialog configuration
- **WHEN** the `ask()` function is called
- **THEN** the dialog SHALL have the title "Confirm Deletion"
- **AND** the dialog kind SHALL be "warning"

#### Scenario: Handle async dialog result
- **WHEN** the user responds to the confirmation dialog
- **THEN** the `handleDelete` function SHALL await the `ask()` Promise
- **AND** if the user clicks "Yes", deletion SHALL proceed
- **AND** if the user clicks "No" or closes the dialog, deletion SHALL be cancelled

#### Scenario: Maintain existing logging
- **WHEN** the confirmation dialog is shown
- **THEN** console logs SHALL be preserved:
  - `[Dashboard] Selected workspace names:` with the list of names
  - `[Dashboard] About to show confirmation dialog`
  - `[Dashboard] Confirmation result:` with the boolean result
  - `[Dashboard] User confirmed, calling performDelete` (if confirmed)

## MODIFIED Requirements

### Requirement: workspace-deletion confirmation dialog
The existing workspace deletion confirmation dialog SHALL use Tauri's native dialog instead of browser confirm.

#### Scenario: Dialog appears in Tauri app
- **GIVEN** the application is running as a Tauri desktop app
- **WHEN** the user initiates workspace deletion
- **THEN** a native OS confirmation dialog SHALL appear
- **AND** the dialog SHALL NOT be blocked by the webview

#### Scenario: Dialog returns correct value
- **WHEN** the user clicks "Yes" in the confirmation dialog
- **THEN** the `ask()` function SHALL return `true`
- **AND** the deletion process SHALL continue

- **WHEN** the user clicks "No" in the confirmation dialog
- **THEN** the `ask()` function SHALL return `false`
- **AND** the deletion process SHALL be cancelled
