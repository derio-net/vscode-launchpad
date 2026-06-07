import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkspaceTable from '../../components/WorkspaceTable';

// Sample workspace data for tests
const mockWorkspaces = [
  {
    id: 'ws-1',
    name: 'My Project',
    path: '/Users/dev/my-project',
    type: 'local',
    lastAccessed: '2024-01-15T10:00:00Z',
  },
  {
    id: 'ws-2',
    name: 'Remote Work',
    path: 'vscode-remote://ssh-remote%2Bmy-server/home/user/project',
    type: 'ssh-remote',
    lastAccessed: '2024-01-14T09:00:00Z',
  },
];

const defaultProps = {
  workspaces: mockWorkspaces,
  sortConfig: { key: 'lastAccessed', direction: 'desc' },
  onSort: jest.fn(),
  validationStatus: {},
  selectedWorkspaces: new Set(),
  onSelectWorkspace: jest.fn(),
  onSelectAll: jest.fn(),
};

describe('WorkspaceTable component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // layout persistence writes through to localStorage — isolate every test
    window.localStorage.clear();
  });

  describe('Spec: WorkspaceTable renders with data', () => {
    it('renders workspace names in table rows', () => {
      render(<WorkspaceTable {...defaultProps} />);
      expect(screen.getByText('My Project')).toBeInTheDocument();
      expect(screen.getByText('Remote Work')).toBeInTheDocument();
    });

    it('renders column headers', () => {
      render(<WorkspaceTable {...defaultProps} />);
      // Use getAllByText since headers may have child elements (resize handles)
      expect(screen.getAllByText(/^Name$/)[0]).toBeInTheDocument();
      // Last Accessed header text may be split by child elements - use role
      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map(h => h.textContent);
      expect(headerTexts.some(t => t.includes('Last Accessed'))).toBe(true);
      expect(headerTexts.some(t => t.includes('Type'))).toBe(true);
    });

    it('renders workspace type labels', () => {
      render(<WorkspaceTable {...defaultProps} />);
      // Type badges may show formatted labels like "Local" or "SSH Remote"
      // Check that type badges are present in the table body
      const typeBadges = document.querySelectorAll('.type-badge');
      expect(typeBadges.length).toBeGreaterThan(0);
    });

    it('renders correct number of rows', () => {
      render(<WorkspaceTable {...defaultProps} />);
      const rows = screen.getAllByRole('row');
      // +1 for header row
      expect(rows.length).toBe(mockWorkspaces.length + 1);
    });
  });

  describe('Spec: WorkspaceTable handles column visibility toggle', () => {
    it('does not render a standalone columns dropdown button', () => {
      render(<WorkspaceTable {...defaultProps} />);
      expect(screen.queryByRole('button', { name: /columns/i })).not.toBeInTheDocument();
    });

    it('Connection column is visible by default', () => {
      render(<WorkspaceTable {...defaultProps} />);
      expect(screen.getByText('Connection')).toBeInTheDocument();
    });

    it('Full Path column is hidden by default', () => {
      render(<WorkspaceTable {...defaultProps} />);
      // Full Path column should be hidden by default per the component code
      expect(screen.queryByText('Full Path')).not.toBeInTheDocument();
    });
  });

  describe('Spec: Header context menu for column visibility', () => {
    const openMenu = (container) => {
      const headerRow = container.querySelector('thead tr');
      fireEvent.contextMenu(headerRow, { clientX: 50, clientY: 20 });
      return container.querySelector('.column-context-menu');
    };

    it('opens at the cursor on header right-click and suppresses the native menu', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      const headerRow = container.querySelector('thead tr');
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 20 });
      fireEvent(headerRow, event);
      expect(event.defaultPrevented).toBe(true);
      expect(container.querySelector('.column-context-menu')).toBeInTheDocument();
    });

    it('lists all data columns and excludes the select column', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      const menu = openMenu(container);
      const keys = [...menu.querySelectorAll('[data-menu-key]')].map(el => el.dataset.menuKey);
      expect(keys).toEqual(
        ['name', 'lastAccessed', 'type', 'claude', 'connection', 'workspacePath', 'path']
      );
    });

    it('Name checkbox is checked, disabled, and cannot be unchecked', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      const menu = openMenu(container);
      const nameItem = menu.querySelector('[data-menu-key="name"]');
      const checkbox = nameItem.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeDisabled();

      fireEvent.click(checkbox);
      expect(container.querySelector('th[data-column-key="name"]')).not.toBeNull(); // column still rendered
    });

    it('unchecking a column hides it; checking shows it again', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      const menu = openMenu(container);
      const connectionCheckbox = menu
        .querySelector('[data-menu-key="connection"]')
        .querySelector('input[type="checkbox"]');

      fireEvent.click(connectionCheckbox);
      expect(container.querySelector('th[data-column-key="connection"]')).toBeNull();

      fireEvent.click(connectionCheckbox);
      expect(container.querySelector('th[data-column-key="connection"]')).not.toBeNull();
    });

    it('closes on Escape and on outside mousedown', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      openMenu(container);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(container.querySelector('.column-context-menu')).toBeNull();

      openMenu(container);
      fireEvent.mouseDown(document.body);
      expect(container.querySelector('.column-context-menu')).toBeNull();
    });

    it('Reset columns restores default visibility and order', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      let menu = openMenu(container);

      // hide connection and show full path
      fireEvent.click(menu.querySelector('[data-menu-key="connection"] input'));
      fireEvent.click(menu.querySelector('[data-menu-key="path"] input'));
      expect(container.querySelector('th[data-column-key="connection"]')).toBeNull();
      expect(container.querySelector('th[data-column-key="path"]')).not.toBeNull();

      fireEvent.click(screen.getByText('Reset columns'));

      expect(container.querySelector('th[data-column-key="connection"]')).not.toBeNull();
      expect(container.querySelector('th[data-column-key="path"]')).toBeNull();
      expect(container.querySelector('.column-context-menu')).toBeNull(); // menu closed
    });

    it('dragging a menu item handle reorders the columns', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      const menu = openMenu(container);

      // give menu items vertical geometry: 30px tall each, stacked
      const items = [...menu.querySelectorAll('[data-menu-key]')];
      items.forEach((el, i) => {
        const top = i * 30;
        el.getBoundingClientRect = () => ({
          top, bottom: top + 30, height: 30, left: 0, right: 190, width: 190, x: 0, y: top,
        });
      });

      // drag 'name' (item 0, y 0-30) below 'lastAccessed' midpoint (y 45)
      const handle = menu.querySelector('[data-menu-key="name"] .column-drag-handle');
      fireEvent.mouseDown(handle, { clientY: 15, button: 0 });
      fireEvent.mouseMove(document, { clientY: 50 });
      fireEvent.mouseUp(document);

      const headerKeys = [...container.querySelectorAll('thead th')].map(th => th.dataset.columnKey);
      expect(headerKeys).toEqual(
        ['select', 'lastAccessed', 'name', 'type', 'connection', 'workspacePath']
      );
    });
  });

  describe('Spec: WorkspaceTable sorting', () => {
    it('calls onSort when column header is clicked', async () => {
      const user = userEvent.setup();
      render(<WorkspaceTable {...defaultProps} />);

      const nameHeader = screen.getByText('Name');
      await user.click(nameHeader);

      expect(defaultProps.onSort).toHaveBeenCalledWith('name');
    });

    it('calls onSort with lastAccessed when Last Accessed header is clicked', async () => {
      const user = userEvent.setup();
      render(<WorkspaceTable {...defaultProps} />);

      // Find the header by role and text content (header may have child elements)
      const headers = screen.getAllByRole('columnheader');
      const lastAccessedHeader = headers.find(h => h.textContent.includes('Last Accessed'));
      expect(lastAccessedHeader).toBeTruthy();
      
      await user.click(lastAccessedHeader);

      expect(defaultProps.onSort).toHaveBeenCalledWith('lastAccessed');
    });
  });

  describe('Spec: WorkspaceTable selection', () => {
    it('renders checkboxes for workspace selection', () => {
      render(<WorkspaceTable {...defaultProps} />);
      const checkboxes = screen.getAllByRole('checkbox');
      // Should have at least one checkbox per workspace + select all
      expect(checkboxes.length).toBeGreaterThanOrEqual(mockWorkspaces.length);
    });

    it('calls onSelectWorkspace when workspace checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(<WorkspaceTable {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      // Click the first workspace checkbox (index 1, after select-all)
      await user.click(checkboxes[1]);

      expect(defaultProps.onSelectWorkspace).toHaveBeenCalled();
    });
  });

  describe('Spec: Adjacent-pair column resizing', () => {
    // jsdom has no layout: give every header cell deterministic geometry.
    // select = 40px, data columns = 150px each, laid out left to right.
    const setupHeaderGeometry = (container) => {
      let left = 0;
      container.querySelectorAll('thead th').forEach(th => {
        const width = th.dataset.columnKey === 'select' ? 40 : 150;
        Object.defineProperty(th, 'offsetWidth', { configurable: true, value: width });
        const at = left;
        th.getBoundingClientRect = () => ({
          left: at, right: at + width, width, top: 0, bottom: 30, height: 30, x: at, y: 0,
        });
        left += width;
      });
    };

    const getTh = (container, key) =>
      container.querySelector(`th[data-column-key="${key}"]`);

    it('resizing trades width only between the adjacent pair', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      setupHeaderGeometry(container);

      const handle = getTh(container, 'name').querySelector('.resize-handle');
      fireEvent.mouseDown(handle, { clientX: 190, button: 0 });
      fireEvent.mouseMove(document, { clientX: 240 }); // +50px

      expect(getTh(container, 'name').style.width).toBe('200px');
      expect(getTh(container, 'lastAccessed').style.width).toBe('100px');
      // every other column keeps its snapshot width — no reflow
      expect(getTh(container, 'type').style.width).toBe('150px');
      expect(getTh(container, 'connection').style.width).toBe('150px');

      fireEvent.mouseUp(document);
    });

    it('clamps the drag so neither column of the pair goes below the minimum', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      setupHeaderGeometry(container);

      const handle = getTh(container, 'name').querySelector('.resize-handle');
      fireEvent.mouseDown(handle, { clientX: 190, button: 0 });
      fireEvent.mouseMove(document, { clientX: 0 }); // -190px, far past the min

      // name clamps at 100 (min), neighbor absorbs exactly the traded 50
      expect(getTh(container, 'name').style.width).toBe('100px');
      expect(getTh(container, 'lastAccessed').style.width).toBe('200px');

      fireEvent.mouseUp(document);
    });

    it('pairs with the next VISIBLE column (hidden columns are skipped)', () => {
      // claude (hookConfigured=false) and path are hidden by default, so
      // type's rendered right neighbor is connection
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      setupHeaderGeometry(container);

      const handle = getTh(container, 'type').querySelector('.resize-handle');
      fireEvent.mouseDown(handle, { clientX: 490, button: 0 });
      fireEvent.mouseMove(document, { clientX: 520 }); // +30px

      expect(getTh(container, 'type').style.width).toBe('180px');
      expect(getTh(container, 'connection').style.width).toBe('120px');

      fireEvent.mouseUp(document);
    });

    it('last visible column has no resize handle', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      // workspacePath is the last visible column by default
      expect(getTh(container, 'workspacePath').querySelector('.resize-handle')).toBeNull();
      expect(getTh(container, 'name').querySelector('.resize-handle')).not.toBeNull();
    });

    it('releasing a resize does not trigger sorting', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      setupHeaderGeometry(container);

      const handle = getTh(container, 'name').querySelector('.resize-handle');
      fireEvent.mouseDown(handle, { clientX: 190, button: 0 });
      fireEvent.mouseMove(document, { clientX: 250 });
      fireEvent.mouseUp(document);

      expect(defaultProps.onSort).not.toHaveBeenCalled();
    });
  });

  describe('Spec: Drag-to-reorder columns', () => {
    const setupHeaderGeometry = (container) => {
      let left = 0;
      container.querySelectorAll('thead th').forEach(th => {
        const width = th.dataset.columnKey === 'select' ? 40 : 150;
        Object.defineProperty(th, 'offsetWidth', { configurable: true, value: width });
        const at = left;
        th.getBoundingClientRect = () => ({
          left: at, right: at + width, width, top: 0, bottom: 30, height: 30, x: at, y: 0,
        });
        left += width;
      });
    };

    const headerKeys = (container) =>
      [...container.querySelectorAll('thead th')].map(th => th.dataset.columnKey);

    it('a completed drag reorders the column and suppresses sorting', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      setupHeaderGeometry(container);

      // drag name right past lastAccessed's midpoint (190 + 75 = 265)
      const nameTh = container.querySelector('th[data-column-key="name"]');
      fireEvent.mouseDown(nameTh, { clientX: 100, clientY: 10, button: 0 });
      fireEvent.mouseMove(document, { clientX: 270, clientY: 10 });
      fireEvent.mouseUp(document);

      expect(headerKeys(container)).toEqual(
        ['select', 'lastAccessed', 'name', 'type', 'connection', 'workspacePath']
      );
      expect(defaultProps.onSort).not.toHaveBeenCalled();
    });

    it('movement under the threshold stays a click and sorts', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      setupHeaderGeometry(container);

      const nameTh = container.querySelector('th[data-column-key="name"]');
      fireEvent.mouseDown(nameTh, { clientX: 100, clientY: 10, button: 0 });
      fireEvent.mouseMove(document, { clientX: 102, clientY: 10 }); // 2px < threshold
      fireEvent.mouseUp(nameTh, { clientX: 102, clientY: 10 });

      expect(defaultProps.onSort).toHaveBeenCalledWith('name');
      expect(headerKeys(container)).toEqual(
        ['select', 'name', 'lastAccessed', 'type', 'connection', 'workspacePath']
      );
    });

    it('the select column is pinned: nothing can be dropped before it', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      setupHeaderGeometry(container);

      // drag name far left, past select — no swap may occur
      const nameTh = container.querySelector('th[data-column-key="name"]');
      fireEvent.mouseDown(nameTh, { clientX: 100, clientY: 10, button: 0 });
      fireEvent.mouseMove(document, { clientX: 5, clientY: 10 });
      fireEvent.mouseUp(document);

      expect(headerKeys(container)[0]).toBe('select');
      expect(headerKeys(container)[1]).toBe('name');
      expect(defaultProps.onSort).not.toHaveBeenCalled();
    });

    it('body cells follow the header order after a drag', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      setupHeaderGeometry(container);

      const nameTh = container.querySelector('th[data-column-key="name"]');
      fireEvent.mouseDown(nameTh, { clientX: 100, clientY: 10, button: 0 });
      fireEvent.mouseMove(document, { clientX: 270, clientY: 10 });
      fireEvent.mouseUp(document);

      const firstRowCells = [...container.querySelectorAll('tbody tr')][0].children;
      // cell 0 = select checkbox, cell 1 = date (lastAccessed), cell 2 = name link
      expect(firstRowCells[1].className).toContain('workspace-date');
      expect(firstRowCells[2].className).toContain('workspace-name');
    });
  });

  describe('Spec: Expandable cells with copy button', () => {
    const pathCell = (container, row = 0) =>
      container.querySelectorAll('tbody tr')[row].querySelector('.workspace-extracted-path');

    const mockClipboard = () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      return writeText;
    };

    afterEach(() => {
      delete navigator.clipboard;
    });

    it('clicking a path cell expands it; clicking again collapses it', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      const cell = pathCell(container);

      fireEvent.click(cell);
      expect(cell.className).toContain('cell-expanded');
      expect(cell.title).toBe(''); // tooltip removed while expanded

      fireEvent.click(cell);
      expect(cell.className).not.toContain('cell-expanded');
    });

    it('only one cell is expanded at a time', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      const first = pathCell(container, 0);
      const second = pathCell(container, 1);

      fireEvent.click(first);
      fireEvent.click(second);

      expect(first.className).not.toContain('cell-expanded');
      expect(second.className).toContain('cell-expanded');
    });

    it('copy button writes the full value to the clipboard and keeps the cell expanded', async () => {
      const writeText = mockClipboard();
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      const cell = pathCell(container);

      fireEvent.click(cell);
      const copyBtn = cell.querySelector('.cell-copy-btn');
      expect(copyBtn).not.toBeNull();

      fireEvent.click(copyBtn);
      expect(writeText).toHaveBeenCalledWith('/Users/dev/my-project');
      // the button click must not collapse the cell
      expect(cell.className).toContain('cell-expanded');
      await waitFor(() => expect(copyBtn.textContent).toBe('✓'));
    });

    it('copy button is hidden when the clipboard API is unavailable', () => {
      // no navigator.clipboard defined in this test
      const { container } = render(<WorkspaceTable {...defaultProps} />);
      const cell = pathCell(container);

      fireEvent.click(cell);
      expect(cell.className).toContain('cell-expanded'); // expansion still works
      expect(cell.querySelector('.cell-copy-btn')).toBeNull();
    });
  });

  describe('Spec: Layout persistence across sessions', () => {
    const openMenu = (container) => {
      fireEvent.contextMenu(container.querySelector('thead tr'), { clientX: 50, clientY: 20 });
      return container.querySelector('.column-context-menu');
    };

    it('column visibility persists across remounts', () => {
      const first = render(<WorkspaceTable {...defaultProps} />);
      const menu = openMenu(first.container);
      fireEvent.click(menu.querySelector('[data-menu-key="connection"] input'));
      expect(first.container.querySelector('th[data-column-key="connection"]')).toBeNull();
      first.unmount();

      const second = render(<WorkspaceTable {...defaultProps} />);
      expect(second.container.querySelector('th[data-column-key="connection"]')).toBeNull();
      expect(second.container.querySelector('th[data-column-key="name"]')).not.toBeNull();
    });

    it('column order persists across remounts', () => {
      const first = render(<WorkspaceTable {...defaultProps} />);
      // reorder via the menu (no geometry needed for header drag)
      const menu = openMenu(first.container);
      const items = [...menu.querySelectorAll('[data-menu-key]')];
      items.forEach((el, i) => {
        const top = i * 30;
        el.getBoundingClientRect = () => ({
          top, bottom: top + 30, height: 30, left: 0, right: 190, width: 190, x: 0, y: top,
        });
      });
      const handle = menu.querySelector('[data-menu-key="name"] .column-drag-handle');
      fireEvent.mouseDown(handle, { clientY: 15, button: 0 });
      fireEvent.mouseMove(document, { clientY: 50 });
      fireEvent.mouseUp(document);
      first.unmount();

      const second = render(<WorkspaceTable {...defaultProps} />);
      const keys = [...second.container.querySelectorAll('thead th')].map(th => th.dataset.columnKey);
      expect(keys).toEqual(['select', 'lastAccessed', 'name', 'type', 'connection', 'workspacePath']);
    });

    it('column widths persist across remounts', () => {
      const first = render(<WorkspaceTable {...defaultProps} />);
      first.container.querySelectorAll('thead th').forEach(th => {
        Object.defineProperty(th, 'offsetWidth', {
          configurable: true,
          value: th.dataset.columnKey === 'select' ? 40 : 150,
        });
      });
      const handle = first.container
        .querySelector('th[data-column-key="name"]')
        .querySelector('.resize-handle');
      fireEvent.mouseDown(handle, { clientX: 190, button: 0 });
      fireEvent.mouseMove(document, { clientX: 240 }); // name 200, lastAccessed 100
      fireEvent.mouseUp(document);
      first.unmount();

      const second = render(<WorkspaceTable {...defaultProps} />);
      expect(second.container.querySelector('th[data-column-key="name"]').style.width).toBe('200px');
      expect(second.container.querySelector('th[data-column-key="lastAccessed"]').style.width).toBe('100px');
    });

    it('Claude auto-shows when hooks are configured and the user never toggled it', () => {
      const { container } = render(<WorkspaceTable {...defaultProps} hookConfigured={true} />);
      expect(container.querySelector('th[data-column-key="claude"]')).not.toBeNull();
    });

    it('a persisted explicit Claude choice beats auto-show', () => {
      const first = render(<WorkspaceTable {...defaultProps} hookConfigured={true} />);
      const menu = openMenu(first.container);
      fireEvent.click(menu.querySelector('[data-menu-key="claude"] input')); // explicitly hide
      expect(first.container.querySelector('th[data-column-key="claude"]')).toBeNull();
      first.unmount();

      // hooks still configured, but the user's choice is respected
      const second = render(<WorkspaceTable {...defaultProps} hookConfigured={true} />);
      expect(second.container.querySelector('th[data-column-key="claude"]')).toBeNull();
    });

    it('Reset columns clears the persisted layout', () => {
      const first = render(<WorkspaceTable {...defaultProps} />);
      const menu = openMenu(first.container);
      fireEvent.click(menu.querySelector('[data-menu-key="connection"] input'));
      expect(window.localStorage.getItem('launchpad.tableLayout')).not.toBeNull();

      fireEvent.click(screen.getByText('Reset columns'));
      expect(window.localStorage.getItem('launchpad.tableLayout')).toBeNull();
      expect(first.container.querySelector('th[data-column-key="connection"]')).not.toBeNull();
    });
  });

  describe('Spec: WorkspaceTable handles empty data', () => {
    it('renders without crashing when workspaces is empty', () => {
      render(<WorkspaceTable {...defaultProps} workspaces={[]} />);
      expect(document.body).toBeInTheDocument();
    });

    it('renders column headers even with empty data', () => {
      render(<WorkspaceTable {...defaultProps} workspaces={[]} />);
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });
});
