/**
 * Persistence for the workspace table layout (column order, visibility, widths).
 * Stored under a single localStorage key; absence of the key yields defaults.
 */

const STORAGE_KEY = 'launchpad.tableLayout';
const MIN_COLUMN_WIDTH = 100;

/**
 * Validate and reconcile a persisted layout against the current column config.
 * - Unknown column keys are dropped
 * - Missing columns are appended at their default positions
 * - 'select' is forced to index 0, Name is forced visible
 * - Widths are clamped to the minimum
 */
export function validateTableLayout(layout, columns) {
  if (!layout || typeof layout !== 'object') return null;
  const knownKeys = columns.map(c => c.key);

  // Order: keep known keys in stored order, then insert missing ones at their
  // default positions (clamped to the current length)
  let order = Array.isArray(layout.order)
    ? layout.order.filter(k => knownKeys.includes(k))
    : [];
  knownKeys.forEach((key, defaultIndex) => {
    if (!order.includes(key)) {
      order.splice(Math.min(defaultIndex, order.length), 0, key);
    }
  });
  order = ['select', ...order.filter(k => k !== 'select')];

  // Visibility: only known keys with boolean values; structural/required invariants
  const visible = {};
  if (layout.visible && typeof layout.visible === 'object') {
    for (const key of knownKeys) {
      if (typeof layout.visible[key] === 'boolean') {
        visible[key] = layout.visible[key];
      }
    }
  }
  visible.select = true;
  visible.name = true;

  // Widths: finite numbers only, clamped to the minimum
  const widths = {};
  if (layout.widths && typeof layout.widths === 'object') {
    for (const key of knownKeys) {
      const w = layout.widths[key];
      if (typeof w === 'number' && Number.isFinite(w)) {
        widths[key] = Math.max(MIN_COLUMN_WIDTH, Math.round(w));
      }
    }
  }

  return { order, visible, widths };
}

/** Load the persisted layout, or null if absent/corrupt. */
export function loadTableLayout(columns) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return validateTableLayout(JSON.parse(raw), columns);
  } catch {
    return null;
  }
}

/** Persist the layout. Storage errors (quota, private mode) are ignored. */
export function saveTableLayout({ order, visible, widths }) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ order, visible, widths }));
  } catch {
    // non-fatal: layout just won't persist
  }
}

/** Remove the persisted layout (Reset columns). */
export function clearTableLayout() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // non-fatal
  }
}

export { STORAGE_KEY };
