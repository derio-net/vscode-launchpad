# Design: Improve Table UX

## Context

`WorkspaceTable.js` renders the workspace table from a flat `COLUMNS` array (`{key, label}` × 8) but the `<thead>` and `<tbody>` are hand-copied per-column JSX blocks. Layout state (`columnWidths`, `visibleColumns`) is React state only — lost on reload. The table uses `table-layout: fixed; width: 100%`; during resize only the dragged column receives an explicit pixel width, so the browser redistributes leftover width among all `auto` columns, causing the whole-table reflow that feels broken. Sort-vs-resize disambiguation is handled by a `resizeCompleted` flag cleared on a 100ms timeout. There is no context menu, no clipboard usage, and no column reordering anywhere in the app. The app runs both in a Tauri v2 WKWebView (where right-click currently shows the native menu) and as a plain web app.

## Goals / Non-Goals

**Goals:**
- Zero-sum adjacent-pair column resizing with no whole-table reflow
- Click-to-expand truncated cells (Path, Full Path, Connection) with a copy button
- Right-click header context menu replacing the "Columns ▼" dropdown (Name locked visible, Select excluded, Reset action)
- Drag-to-reorder columns via header drag and via menu drag handles
- Persist order/visibility/widths across restarts via localStorage
- One unified gesture model for the header (sort / resize / reorder / context menu)

**Non-Goals:**
- No row-level drag/reorder, no server or Tauri/Rust changes
- No touch/pointer-events support beyond mouse (existing code is mouse-only)
- No column pinning/freezing beyond the structural Select column
- No text-selection-to-copy flow in expanded cells (copy button is the affordance)
- No virtualization or performance work on table rendering

## Decisions

### D1: Column config + order-array rendering (prerequisite refactor)

`COLUMNS` becomes the single source of column metadata:

```js
const COLUMNS = [
  { key: 'select',        structural: true },                                  // pinned, excluded from menu
  { key: 'name',          label: 'Name',          required: true },            // visibility locked
  { key: 'lastAccessed',  label: 'Last Accessed' },
  { key: 'type',          label: 'Type' },
  { key: 'claude',        label: 'Claude' },                                   // auto-show gated by hookConfigured
  { key: 'connection',    label: 'Connection',    expandable: true },
  { key: 'workspacePath', label: 'Path',          expandable: true },
  { key: 'path',          label: 'Full Path',     expandable: true, defaultHidden: true }
];
```

A `columnOrder` state array (`['select', 'name', ...]`) drives render order. Both `<thead>` and `<tbody>` map over `columnOrder.filter(visible)`; per-column cell JSX moves into a `renderCell(column, workspace)` switch (or per-key renderer map). This replaces ~7 duplicated `<th>` blocks and the hardcoded `<td>` sequence.

*Why not keep hardcoded JSX?* Reordering makes dynamic order mandatory for the body anyway; every other feature (pair-resize neighbor lookup, expandable flag, Name lock) reads from the same config.

### D2: Adjacent-pair resize via width snapshot

On resize `mousedown`:
1. Snapshot **all** visible columns' `th.offsetWidth` into `columnWidths` (explicit px everywhere — removes all `auto` columns, so nothing can reflow).
2. Identify the pair: the dragged column and the **next visible** column in `columnOrder`.
3. On `mousemove`: `clampedDiff = clamp(diff, MIN − startLeft, startRight − MIN)`; `left = startLeft + clampedDiff`, `right = startRight − clampedDiff`. `MIN = 100` (matches existing CSS `min-width`).
4. Total table width is invariant during the drag.

The **last visible column renders no resize handle** (its width is the remainder). The Select column keeps its fixed 40px and never participates (the handle on Name's right edge pairs Name with its right neighbor; Select has no handle).

*Window resize afterwards*: with all-explicit px widths and `width: 100%` fixed layout, browsers scale columns proportionally — accepted behavior, no extra handling.

*Newly shown column after a snapshot*: arrives with no stored width → `auto` → takes leftover space. Accepted.

*Alternative considered*: resize only the dragged column and let the table grow into `overflow-x: auto`. Rejected — user explicitly wants the adjacent-pair model; total-width-invariant feels stable.

### D3: Unified header gesture arbiter

One state machine on the header replaces the `resizeCompleted` timeout hack:

```
mousedown on resize-handle ──────────────► RESIZING (until mouseup; never sorts)
mousedown on th (left btn) ─► PENDING ─┬─ mouseup, moved < 5px ─► SORT
                                       └─ moved ≥ 5px ──────────► DRAGGING (reorder;
                                                                  mouseup commits, never sorts)
contextmenu on thead ──────────────────► open menu (preventDefault suppresses native menu)
```

Implementation: `gestureRef = { mode: 'idle'|'pending'|'resizing'|'dragging', startX, startY, columnKey, ... }`. Document-level `mousemove`/`mouseup` listeners attach during `pending`/`resizing`/`dragging` (same pattern as the existing resize listeners). The `onClick` sort handler is replaced by gesture-resolved `mouseup` handling, eliminating `resizeCompleted` and its `setTimeout`.

*Why movement threshold (5px) over hold-timer?* Distance-based disambiguation is the platform convention (Finder, spreadsheets); timers either delay sort feedback or misfire for slow clicks.

### D4: Drag-reorder with live-swap

During `dragging`:
- The dragged `<th>` gets a visual "lifted" style (class-based: elevated opacity/background); a `transform: translateX()` follows the cursor delta for the lift effect. No HTML5 drag-and-drop API (ugly native ghost, quirky in WKWebView, no styling control); manual mouse events match the existing resize pattern.
- When the cursor crosses the horizontal midpoint of an adjacent visible header, the two keys swap in `columnOrder`; React re-renders header and body in the new order immediately (cheap with `table-layout: fixed`).
- The Select column is pinned: `select` never moves, and no column can be placed before it (swap targets exclude index 0).
- Name is reorderable (lock is visibility-only).
- `mouseup` commits (order already in state; persist) and suppresses sort.

### D5: Cursor-anchored context menu

- `onContextMenu` on the `<thead>` row: `preventDefault()` (suppresses native WKWebView menu), open menu at `{ x: e.clientX, y: e.clientY }`, `position: fixed`, clamped to viewport edges.
- Content: data columns only (Select excluded), in current `columnOrder`, each row = `≡` drag handle + checkbox + label. Name's checkbox is checked + disabled with a lock indicator. Footer action: **Reset columns** (clears the localStorage key, restores default order/visibility/widths).
- Menu item reorder uses the same manual-drag approach vertically (midpoint swap on the menu items, mutating the same `columnOrder`). Hidden columns are reorderable here.
- Close on outside `mousedown`, `Escape`, or window blur. Reuses/adapts existing `.column-menu` CSS; `.table-controls` bar and "Columns ▼" button are deleted.
- The "at least one visible column" guard (`handleColumnVisibilityToggle`) is deleted — Name's lock guarantees the invariant.

### D6: Expandable cells with copy button

- Cells of `expandable: true` columns get `onClick` toggling an `expandedCell` state (`{rowId, columnKey}` — single cell expanded at a time; clicking another cell moves the expansion).
- Expanded style: `white-space: normal; word-break: break-all;` removes ellipsis; row height grows naturally.
- A `📋` copy button renders inside the expanded cell; `navigator.clipboard.writeText(fullValue)` with a transient "Copied" confirmation (e.g., button briefly becomes ✓). Click on the button does not toggle collapse (`stopPropagation`).
- No text-selection handling needed (copy button is the affordance), avoiding the selection-vs-collapse conflict entirely.
- `navigator.clipboard` works in Tauri v2 (secure context) and localhost web mode; no Tauri clipboard plugin.

### D7: localStorage persistence

Single key `launchpad.tableLayout`:

```json
{ "order": ["select","name",...], "visible": {"name":true,...}, "widths": {"name":190,...} }
```

- Lazy-init state from localStorage (`useState(() => load())`); write-through on every order/visibility/width commit (resize mouseup, reorder mouseup, visibility toggle).
- **Validation on load**: unknown keys dropped, missing keys appended in default order, `select` forced to index 0, `name.visible` forced `true`, widths clamped to ≥100. Corrupt JSON → defaults.
- **Claude auto-show precedence**: the existing `useEffect` auto-shows Claude when `hookConfigured` flips true — this now applies **only if `claude` is absent from the persisted `visible` map** (user never touched it). An explicit persisted choice wins. Any manual toggle of Claude writes the key, making the choice durable.
- Reset action: remove the key, reset state to defaults.

## Risks / Trade-offs

- [Header gesture density: sort, resize, reorder, context menu on one surface] → Distance threshold + handle hit-zones keep gestures disjoint; the arbiter is a single small state machine rather than scattered flags, and it deletes the existing `resizeCompleted` hack.
- [Right-click-only visibility menu is undiscoverable] → Accepted deliberately (owner's choice); native-feeling for a desktop app. The deleted button was the only visible hint.
- [Live-swap re-renders the whole table per swap] → Swaps occur at most once per midpoint crossing, not per mousemove; table sizes here (tens of rows) make this negligible.
- [Proportional column rescale on window resize after explicit widths] → Accepted; matches `width: 100%` semantics and avoids horizontal scrollbars by default.
- [E2E tests reference the "Columns ▼" button] → Update specs as part of the change; context-menu flow is scriptable in Playwright via `click({ button: 'right' })`.
- [`navigator.clipboard` could be unavailable in non-secure contexts (e.g., LAN-hosted web mode)] → Fallback: hide copy button if `navigator.clipboard` is undefined; expansion still shows the full path.
- [Stale persisted layout after future column additions] → Load-time validation appends unknown/new columns at default positions; no migration code needed.

## Open Questions

None — all interaction decisions were settled in exploration (last-column handle removed; copy button only; both paths + Connection expandable; Select excluded from menu; menu reorder via drag handles; Name visibility-locked but reorderable; persisted Claude choice beats auto-show).
