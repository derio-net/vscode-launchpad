## Why

The workspace deletion feature uses `window.confirm()` to show a confirmation dialog before removing workspace references from the OS Path. However, Tauri's webview blocks native browser dialogs like `window.confirm()`, causing it to immediately return `false` without displaying any dialog to the user. This prevents users from deleting workspaces in the Tauri desktop application.

This change replaces the native browser confirmation dialog with Tauri's dialog plugin, which provides native OS-level confirmation dialogs that work properly in the Tauri desktop environment.

## What Changes

- **Tauri Dialog Plugin Integration**: Add `tauri-plugin-dialog` to the Tauri application dependencies and initialize it in the Rust backend
- **Frontend Dialog Replacement**: Replace `window.confirm()` call in `Dashboard.js` with Tauri's `ask()` API from `@tauri-apps/plugin-dialog`
- **Permissions Configuration**: Add dialog permissions to `capabilities/default.json` to allow the frontend to invoke dialog commands

## Capabilities

### New Capabilities
- `tauri-confirmation-dialog`: Use Tauri's native dialog plugin for confirmation dialogs in the desktop application

### Modified Capabilities
- `workspace-deletion`: Update confirmation dialog implementation to use Tauri dialog API instead of browser `window.confirm()`

## Impact

- **Frontend**: [`src/components/Dashboard.js`](src/components/Dashboard.js:228) - Replace `window.confirm()` with Tauri `ask()` API
- **Backend**: [`src-tauri/Cargo.toml`](src-tauri/Cargo.toml) - Add `tauri-plugin-dialog` dependency
- **Backend**: [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) - Initialize dialog plugin in Tauri builder
- **Configuration**: [`src-tauri/capabilities/default.json`](src-tauri/capabilities/default.json) - Add `dialog:allow-ask` permission
