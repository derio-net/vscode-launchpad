## 1. Backend - Add Tauri Dialog Plugin Dependency

- [ ] 1.1 Add `tauri-plugin-dialog = "2"` to `src-tauri/Cargo.toml` dependencies section
- [ ] 1.2 Verify the plugin version is compatible with existing Tauri v2.x dependencies

## 2. Backend - Initialize Dialog Plugin

- [ ] 2.1 Add `tauri_plugin_dialog` import to `src-tauri/src/lib.rs`
- [ ] 2.2 Add `.plugin(tauri_plugin_dialog::init())` to the Tauri builder chain in the `run()` function
- [ ] 2.3 Ensure plugin initialization is called before `run()`

## 3. Configuration - Add Dialog Permissions

- [ ] 3.1 Add `"dialog:allow-ask"` permission to `src-tauri/capabilities/default.json`
- [ ] 3.2 Verify the permission is in the `permissions` array
- [ ] 3.3 Ensure the permission applies to the "main" window

## 4. Frontend - Integrate Tauri Dialog API

- [ ] 4.1 Add import: `import { ask } from '@tauri-apps/plugin-dialog';` to `src/components/Dashboard.js`
- [ ] 4.2 Convert `handleDelete` function to async
- [ ] 4.3 Replace `window.confirm()` call with `ask()` API:
  ```javascript
  const confirmed = await ask(
    `Are you sure you want to delete ${selectedWorkspaces.size} workspace(s) from your Path?\n\n` +
    `This will remove the following workspace references:\n  - ${names}\n\n` +
    `Note: This only removes the workspace reference from VS Code:'s history. ` +
    `Your actual project files will NOT be deleted.`,
    { title: 'Confirm Deletion', kind: 'warning' }
  );
  ```
- [ ] 4.4 Ensure existing console.log statements are preserved
- [ ] 4.5 Ensure `performDelete()` is only called when `confirmed` is true

## 5. Testing and Verification

- [ ] 5.1 Build the Tauri application with `npm run tauri build` or `cargo build`
- [ ] 5.2 Launch the desktop application
- [ ] 5.3 Select one or more workspaces for deletion
- [ ] 5.4 Click the delete button and verify the confirmation dialog appears
- [ ] 5.5 Verify the dialog shows the correct workspace names
- [ ] 5.6 Click "No" and verify deletion is cancelled
- [ ] 5.7 Click "Yes" and verify deletion proceeds
- [ ] 5.8 Check browser console for expected log messages
- [ ] 5.9 Test on target platform (macOS/Linux/Windows)

## 6. Documentation Update

- [ ] 6.1 Update any relevant documentation mentioning `window.confirm()`
- [ ] 6.2 Note the Tauri dialog plugin requirement in build instructions if needed
