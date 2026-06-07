# Tasks: Improve Table UX

## 1. Column Config Refactor (prerequisite)

- [x] 1.1 Extend `COLUMNS` config in `WorkspaceTable.js` with `structural`, `required`, `expandable`, `defaultHidden` flags (design D1)
- [x] 1.2 Add `columnOrder` state (default: COLUMNS order) and render `<thead>` by mapping over `columnOrder` filtered by visibility, replacing the 7 hardcoded `<th>` blocks
- [x] 1.3 Extract per-column cell rendering into a `renderCell(column, workspace)` map/switch and render `<tbody>` rows by mapping over the same ordered visible columns
- [x] 1.4 Verify no behavior change: existing frontend unit tests pass (`npm test`), table renders identically

## 2. Gesture Arbiter + Adjacent-Pair Resize

- [x] 2.1 Implement the header gesture state machine (`idle`/`pending`/`resizing`/`dragging`) with document-level mousemove/mouseup listeners; replace th `onClick` sort with gesture-resolved mouseup (5px threshold); delete the `resizeCompleted` flag and its setTimeout (design D3)
- [x] 2.2 On resize start, snapshot all visible columns' `offsetWidth` into `columnWidths`; compute the resize pair as (dragged column, next visible column in `columnOrder`)
- [x] 2.3 Implement zero-sum pair resize on mousemove with diff clamped so both columns stay ≥100px (design D2)
- [x] 2.4 Render no resize handle on the last visible column; Select column keeps fixed 40px with no handle
- [x] 2.5 Unit tests: pair-resize math (clamping, hidden-neighbor skip), resize-release does not sort, sort still works on plain click

## 3. Drag-to-Reorder Columns

- [x] 3.1 Implement header drag mode: lifted visual style + `translateX` follow on the dragged `<th>` (design D4)
- [x] 3.2 Implement live-swap: swap adjacent keys in `columnOrder` when cursor crosses a neighbor header's midpoint; body follows via ordered rendering
- [x] 3.3 Pin the Select column: not draggable, no drops before index 0; Name remains reorderable
- [x] 3.4 Commit order on mouseup, suppress sort after a completed drag
- [x] 3.5 Unit tests: threshold disambiguation (click sorts / drag reorders), select pinning, order state after swaps

## 4. Header Context Menu

- [x] 4.1 Add `onContextMenu` on the header row: `preventDefault()`, open cursor-anchored menu (`position: fixed`, viewport-edge clamped); close on outside mousedown / Escape / blur (design D5)
- [x] 4.2 Render menu items for data columns in current `columnOrder`: ≡ drag handle + checkbox + label; exclude `select`; Name checkbox checked + disabled with lock indicator
- [x] 4.3 Wire visibility toggles to the menu; delete the "Columns ▼" button, `table-controls` bar, and the "at least one visible column" guard in `handleColumnVisibilityToggle`
- [x] 4.4 Implement vertical drag-reorder of menu items (midpoint swap mutating `columnOrder`), including hidden columns
- [x] 4.5 Add "Reset columns" menu action: restore default order/visibility/widths and clear persisted state (storage clear lands with 6.1)
- [x] 4.6 Update `WorkspaceTable.css`: cursor-anchored menu styles, drag-handle/lock styles, remove `.table-controls`/`.column-toggle-btn` styles
- [x] 4.7 Unit tests: menu opens on contextmenu and lists correct items, Name cannot be unchecked, Select absent, reset restores defaults

## 5. Expandable Cells with Copy

- [x] 5.1 Add `expandedCell` state (`{rowId, columnKey}`, single-cell); click on `expandable` column cells toggles expansion, clicking another cell moves it (design D6)
- [x] 5.2 Add expanded-cell CSS: `white-space: normal; word-break: break-all`, ellipsis removed; applies to Path, Full Path, Connection
- [x] 5.3 Render copy button inside expanded cells: `navigator.clipboard.writeText(fullValue)` with transient ✓ confirmation, `stopPropagation` so it doesn't collapse; hide button when clipboard API unavailable
- [x] 5.4 Unit tests: expand/collapse/single-expansion behavior, copy writes full value (clipboard mock), button hidden without clipboard API

## 6. Layout Persistence

- [x] 6.1 Implement load/save for `launchpad.tableLayout` (`{order, visible, widths}`): lazy-init state from localStorage, write-through on resize/reorder/visibility commits (design D7)
- [x] 6.2 Implement load-time validation: drop unknown keys, append missing columns at default positions, force `select` to index 0 and `name` visible, clamp widths ≥100, fall back to defaults on corrupt JSON
- [x] 6.3 Gate Claude auto-show on `claude` being absent from the persisted `visible` map; any manual Claude toggle persists the explicit choice
- [x] 6.4 Unit tests: round-trip persistence, validation/reconciliation cases, Claude auto-show precedence (untouched → auto-shows; persisted false → stays hidden)

## 7. E2E + Verification

- [x] 7.1 Update Playwright E2E specs that use the "Columns ▼" button to the right-click context-menu flow (`click({ button: 'right' })`)
- [x] 7.2 Add E2E coverage: adjacent-pair resize leaves other columns untouched, drag-reorder persists across reload, path cell expand + copy button
- [x] 7.3 Run full suite (`npm run test:all`, `npm run test:e2e`) and verify in `npm run tauri:dev` that the native context menu is suppressed on the header and clipboard copy works in the Tauri webview
  - `test:all` 167/167 green; E2E chromium 29/29 green (CI parity); `CI=true npm run build` clean. Also fixed a pre-existing order-dependent mock in `e2e/claude-sessions.spec.js` (route must be installed before goto on machines with hooks configured).
  - Manual check in `npm run tauri:dev` passed (2026-06-07): native menu suppressed on header right-click; copy button works; resize/reorder/persistence confirmed by operator.

## 8. Post-verification feedback (operator review)

- [x] 8.1 Add a drag-follow visual effect to context-menu item reordering (translateY lift, matching the header drag treatment)
- [x] 8.2 Fix Cmd+V (and standard edit shortcuts) in the Tauri webview — root cause: the custom Edit menu used `MenuItem::with_id` accelerators with no handlers, swallowing the keystrokes; replaced with `PredefinedMenuItem`s (undo/redo/cut/copy/paste/select_all) on both macOS and Windows/Linux menus so shortcuts route to the native responder chain. Verified by operator in `tauri:dev` (2026-06-07).
