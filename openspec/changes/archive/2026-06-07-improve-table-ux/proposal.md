# Improve Table UX

## Why

The workspace table's interaction model has accumulated rough edges: resizing one column reflows every other column (only the dragged column gets an explicit width, so the browser renegotiates all `auto` columns), long paths are truncated with no way to copy them, column visibility hides behind a dropdown button, and columns cannot be reordered at all. Two already-specced requirements — width persistence and a reset control (`resizable-table-columns`) — were never implemented. This change makes the table behave like a proper desktop app table: predictable resizing, copyable paths, a right-click header menu, drag-to-reorder, and layout that survives restarts.

## What Changes

- **Adjacent-pair column resizing**: dragging the handle between two columns becomes a zero-sum trade between that pair only — all other columns keep their widths. On drag start, all visible column widths are snapshotted to explicit pixel values. The last visible column has no resize handle. Minimum width (100px) enforced on both columns in the pair. "Adjacent" means next *visible* column.
- **Click-to-expand cells with copy button**: clicking a truncated Path, Full Path, or Connection cell expands it in place (wrapped text) and shows a copy-to-clipboard button. Clicking again collapses it.
- **Right-click header context menu** replaces the "Columns ▼" dropdown button (button and `table-controls` bar removed). The menu opens at the cursor on right-click anywhere in the header row, suppressing the native webview context menu. It lists data columns with visibility checkboxes; the structural Select column is excluded. **Name can never be deselected** (checkbox locked) — this guarantees the "at least one column visible" invariant. The menu also hosts a "Reset columns" action (restores default widths, order, and visibility), satisfying the previously unimplemented reset requirement.
- **Drag-to-reorder columns**: left-click + hold on a header and moving ≥ ~5px enters drag mode (plain click + release still sorts; a completed drag suppresses the sort). Columns live-swap as the dragged header crosses neighbors' midpoints; body cells follow. The Select column is pinned at position 0. The context menu mirrors column order and provides drag handles (≡) to reorder there too — including hidden columns.
- **Layout persistence**: column order, visibility, and widths persist to `localStorage` under a single key, restored on load (fulfills the existing-but-unimplemented persistence requirement and extends it to visibility/order). Name is forced visible on load regardless of stored state. The Claude column's auto-show-when-hooks-configured behavior applies only when the user has never explicitly toggled Claude visibility; a persisted explicit choice wins.
- **Prerequisite refactor**: the `COLUMNS` array becomes a richer config (`key`, `label`, `required`, `expandable`, `structural`, default visibility, cell renderer), and both `<thead>` and `<tbody>` render by mapping over a dynamic column-order array, replacing the hand-copied per-column JSX blocks. No behavior change by itself; it is what makes each feature above a small diff.

## Capabilities

### New Capabilities

- `column-reordering`: drag-to-reorder table columns via header drag (with click-vs-drag disambiguation against sorting) and via drag handles in the header context menu; Select column pinned; order persisted.
- `expandable-cell-content`: click-to-expand truncated table cells (Path, Full Path, Connection) with in-place wrapped display and a copy-to-clipboard button.

### Modified Capabilities

- `resizable-table-columns`: resize semantics change from "adjacent columns adjust to maintain table layout" (in practice: all auto columns reflow) to strict adjacent-pair zero-sum resizing; last visible column loses its handle; width persistence moves from aspirational to `localStorage`-backed; "Reset Columns" control is realized as a context-menu action instead of a button.
- `column-visibility-toggle`: the dropdown button UI is replaced by a right-click header context menu; the Select column is excluded from the menu; the Name column becomes permanently visible (replacing the generic "at least one column remains visible" rule); visibility persists across sessions (was session-only); Claude auto-show is subordinated to an explicit persisted user choice.

## Impact

- **Frontend only** — no server, API, or Tauri/Rust changes.
  - `src/components/WorkspaceTable.js`: major rework (config-driven rendering, gesture handling, context menu, persistence). The `resizeCompleted` timeout hack is replaced by a unified click/drag/resize gesture arbiter.
  - `src/components/WorkspaceTable.css`: context-menu positioning (cursor-anchored), expanded-cell styles, drag feedback styles; `table-controls` styles removed.
- **Clipboard**: uses `navigator.clipboard.writeText()` (secure context in Tauri v2 webview and on localhost web mode); no Tauri clipboard plugin needed.
- **Tests**: frontend unit tests for gesture disambiguation, pair-resize math, visibility/order/width persistence (localStorage mock), Name lock, Claude auto-show precedence, expand/copy. Existing E2E dashboard specs that reference the "Columns ▼" button must be updated to the context-menu flow.
- **No data migration**: absence of the localStorage key yields current default layout.
