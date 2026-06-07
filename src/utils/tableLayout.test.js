import {
  validateTableLayout,
  loadTableLayout,
  saveTableLayout,
  clearTableLayout,
  STORAGE_KEY,
} from './tableLayout';

const COLUMNS = [
  { key: 'select', structural: true },
  { key: 'name', required: true },
  { key: 'alpha' },
  { key: 'beta' },
];

describe('tableLayout persistence utils', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('Spec: round-trip persistence', () => {
    it('save then load returns the same layout', () => {
      const layout = {
        order: ['select', 'beta', 'name', 'alpha'],
        visible: { name: true, alpha: false, beta: true },
        widths: { name: 190, alpha: 140 },
      };
      saveTableLayout(layout);
      expect(loadTableLayout(COLUMNS)).toEqual({
        order: ['select', 'beta', 'name', 'alpha'],
        visible: { select: true, name: true, alpha: false, beta: true },
        widths: { name: 190, alpha: 140 },
      });
    });

    it('returns null when nothing is stored', () => {
      expect(loadTableLayout(COLUMNS)).toBeNull();
    });

    it('returns null for corrupt JSON', () => {
      window.localStorage.setItem(STORAGE_KEY, '{not json');
      expect(loadTableLayout(COLUMNS)).toBeNull();
    });

    it('clearTableLayout removes the stored key', () => {
      saveTableLayout({ order: [], visible: {}, widths: {} });
      clearTableLayout();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('Spec: load-time validation and reconciliation', () => {
    it('drops unknown column keys from the order', () => {
      const result = validateTableLayout(
        { order: ['select', 'name', 'ghost', 'alpha', 'beta'] },
        COLUMNS
      );
      expect(result.order).toEqual(['select', 'name', 'alpha', 'beta']);
    });

    it('appends missing columns at their default positions', () => {
      // 'beta' missing from a stored order (e.g. column added in a new version)
      const result = validateTableLayout(
        { order: ['select', 'alpha', 'name'] },
        COLUMNS
      );
      expect(result.order).toHaveLength(4);
      expect(result.order).toContain('beta');
      expect(result.order[0]).toBe('select');
    });

    it('forces select to index 0', () => {
      const result = validateTableLayout(
        { order: ['alpha', 'select', 'name', 'beta'] },
        COLUMNS
      );
      expect(result.order[0]).toBe('select');
    });

    it('forces name visible regardless of stored value', () => {
      const result = validateTableLayout(
        { visible: { name: false, alpha: false } },
        COLUMNS
      );
      expect(result.visible.name).toBe(true);
      expect(result.visible.alpha).toBe(false);
    });

    it('drops non-boolean visibility values and non-finite widths', () => {
      const result = validateTableLayout(
        {
          visible: { alpha: 'yes', beta: true },
          widths: { alpha: 'wide', beta: Infinity, name: 250 },
        },
        COLUMNS
      );
      expect(result.visible).toEqual({ select: true, name: true, beta: true });
      expect(result.widths).toEqual({ name: 250 });
    });

    it('clamps widths to the 100px minimum', () => {
      const result = validateTableLayout(
        { widths: { alpha: 30, beta: 180 } },
        COLUMNS
      );
      expect(result.widths).toEqual({ alpha: 100, beta: 180 });
    });

    it('returns null for non-object input', () => {
      expect(validateTableLayout(null, COLUMNS)).toBeNull();
      expect(validateTableLayout('junk', COLUMNS)).toBeNull();
    });
  });
});
