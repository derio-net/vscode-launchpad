## Context

The VS Code: Workspace Dashboard uses a confirmation dialog before deleting workspace references to prevent accidental data loss. The current implementation uses the browser's native `window.confirm()` API. However, this approach doesn't work in Tauri's webview environment because Tauri blocks native browser dialogs for security reasons, causing `window.confirm()` to immediately return `false` without displaying any UI.

This change migrates the confirmation dialog to use Tauri's dialog plugin, which provides native OS-level dialogs that work correctly in the desktop application.

## Goals / Non-Goals

**Goals:**
- Replace `window.confirm()` with Tauri's dialog plugin in the desktop application
- Maintain the same user experience: show a confirmation dialog with workspace names before deletion
- Ensure the dialog works correctly on all supported platforms (macOS, Linux, Windows)
- Keep the dialog message content identical to the current implementation

**Non-Goals:**
- Changing the dialog's visual design or message content
- Adding new dialog types (alerts, file pickers, etc.)
- Supporting both web and desktop modes with the same code path
- Modifying the deletion logic itself (only the confirmation mechanism)

## Decisions

### 1. Tauri Dialog Plugin vs Custom Modal

**Decision**: Use Tauri's official `tauri-plugin-dialog` instead of a custom React modal.

**Rationale**:
- Native OS look and feel that matches the platform
- Already integrated with Tauri's permission system
- Handles accessibility and keyboard navigation automatically
- No additional UI component library needed

**Alternative considered**: Custom React modal component - rejected because it requires more code, doesn't match native OS styling, and needs manual accessibility implementation.

### 2. Conditional Dialog Implementation

**Decision**: Use Tauri's `ask()` API directly in the desktop app without web fallback.

**Rationale**:
- The Tauri app is the primary deployment target
- The web version can be addressed separately if needed
- Simpler code path without environment detection

**Implementation approach**:
```javascript
// Import Tauri dialog API
import { ask } from '@tauri-apps/plugin-dialog';

// Replace window.confirm() with ask()
const confirmed = await ask(
  `Are you sure you want to delete ${selectedWorkspaces.size} workspace(s) from your Path?\n\n` +
  `This will remove the following workspace references:\n  - ${names}\n\n` +
  `Note: This only removes the workspace reference from VS Code:'s history. ` +
  `Your actual project files will NOT be deleted.`,
  { title: 'Confirm Deletion', kind: 'warning' }
);
```

### 3. Async Handling

**Decision**: Make the confirmation handler async to accommodate Tauri's Promise-based API.

**Rationale**:
- Tauri's `ask()` returns a Promise<boolean>
- The existing code expects a synchronous boolean
- Need to use `await` or `.then()` to handle the async result

**Implementation**:
- Mark the `handleDelete` function as `async`
- Use `await` when calling `ask()`
- Wrap the deletion logic in a conditional based on the result

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Dialog plugin not available in web builds | This change only affects the Tauri desktop app; web builds would need a separate implementation |
| Async conversion breaks existing flow | Carefully refactor `handleDelete` to handle async properly; maintain same user-visible behavior |
| Permission denied errors | Add explicit `dialog:allow-ask` permission to capabilities file |
| Plugin version compatibility | Use the same major version as other Tauri plugins (v2) |

## Migration Plan

1. **Add dependency**: Update `src-tauri/Cargo.toml` with `tauri-plugin-dialog = "2"`
2. **Initialize plugin**: Add `.plugin(tauri_plugin_dialog::init())` to `src-tauri/src/lib.rs`
3. **Add permissions**: Include `dialog:allow-ask` in `src-tauri/capabilities/default.json`
4. **Update frontend**: Replace `window.confirm()` with `ask()` in `src/components/Dashboard.js`
5. **Test**: Verify the dialog appears and returns correct values on all platforms

## Open Questions

- Should we maintain backward compatibility for web-based deployments?
- Do we need different dialog styling for different platforms?
- Should we add an option to "Don't ask again" for power users?
