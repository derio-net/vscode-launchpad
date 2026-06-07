import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import './WorkspaceTable.css';
import { open } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { extractConnectionInfo, extractWorkspacePath } from '../utils/workspaceUtils';
import { loadTableLayout, saveTableLayout, clearTableLayout } from '../utils/tableLayout';

const COLUMNS = [
  { key: 'select', label: '', structural: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'lastAccessed', label: 'Last Accessed' },
  { key: 'type', label: 'Type' },
  { key: 'claude', label: 'Claude' },
  { key: 'connection', label: 'Connection', expandable: true },
  { key: 'workspacePath', label: 'Path', expandable: true },
  { key: 'path', label: 'Full Path', expandable: true, defaultHidden: true }
];

const DEFAULT_ORDER = COLUMNS.map(c => c.key);

const MIN_COLUMN_WIDTH = 100; // matches th min-width in CSS
const DRAG_THRESHOLD = 5; // px of movement that turns a click (sort) into a drag (reorder)

// Default visibility map; the Claude column is gated on hook configuration
const defaultVisibleColumns = (claudeVisible) => COLUMNS.reduce((acc, c) => {
  acc[c.key] = c.key === 'claude' ? claudeVisible : !c.defaultHidden;
  return acc;
}, {});

function WorkspaceTable({
  workspaces,
  sortConfig,
  onSort,
  validationStatus = {},
  selectedWorkspaces = new Set(),
  onSelectWorkspace,
  onSelectAll,
  sessionMap = new Map(),
  hookConfigured = false
}) {
  // Persisted layout, loaded once on mount (design D7)
  const storedLayoutRef = useRef(undefined);
  if (storedLayoutRef.current === undefined) {
    storedLayoutRef.current = loadTableLayout(COLUMNS); // null when nothing stored
  }
  const storedLayout = storedLayoutRef.current;

  const [columnWidths, setColumnWidths] = useState(() => storedLayout?.widths || {});
  const [columnOrder, setColumnOrder] = useState(() => storedLayout?.order || DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState(() => ({
    ...defaultVisibleColumns(hookConfigured),
    ...(storedLayout?.visible || {})
  }));
  // Whether the user has ever explicitly toggled the Claude column. While
  // untouched, the auto-show-on-hook-configuration behavior stays in effect
  // and Claude's visibility is NOT persisted.
  const claudeTouchedRef = useRef(
    !!storedLayout?.visible && Object.prototype.hasOwnProperty.call(storedLayout.visible, 'claude')
  );
  const suppressPersistRef = useRef(true); // skip persisting until the user changes something
  // Single expanded cell: { rowId, columnKey } or null (design D6)
  const [expandedCell, setExpandedCell] = useState(null);
  const [copied, setCopied] = useState(false); // transient ✓ on the copy button
  const copyTimerRef = useRef(null);
  // Header context menu: { x, y } anchored at the right-click position, or null
  const [contextMenu, setContextMenu] = useState(null);
  const [menuDragVisual, setMenuDragVisual] = useState(null); // { key, dy } while dragging a menu item
  const menuRef = useRef(null);

  // Auto-show the Claude column when hooks become configured — but only while
  // the user has never explicitly toggled it; a persisted choice wins (design D7)
  useEffect(() => {
    if (hookConfigured && !claudeTouchedRef.current) {
      setVisibleColumns(prev => (prev.claude ? prev : { ...prev, claude: true }));
    }
  }, [hookConfigured]);

  // Header gesture arbiter (design D3): one state machine resolves
  // sort (click), resize (handle drag), and reorder (header drag).
  const gestureRef = useRef({ mode: 'idle' });
  const [gestureActive, setGestureActive] = useState(false);
  const [dragVisual, setDragVisual] = useState(null); // { key, dx } while dragging a header
  const tableRef = useRef(null);

  // Write-through persistence: save on any committed layout change. Skipped
  // while a gesture is in flight (per-mousemove width/order churn) — the
  // gestureActive flip on mouseup re-runs this effect and saves the final
  // state. The suppress flag skips the mount run and the reset run (which
  // clears storage).
  useEffect(() => {
    if (gestureActive) return; // mid-drag: wait for the commit on mouseup
    if (suppressPersistRef.current) {
      suppressPersistRef.current = false;
      return;
    }
    const visibleToStore = { ...visibleColumns };
    if (!claudeTouchedRef.current) {
      delete visibleToStore.claude; // keep auto-show eligible across sessions
    }
    saveTableLayout({ order: columnOrder, visible: visibleToStore, widths: columnWidths });
  }, [columnOrder, visibleColumns, columnWidths, gestureActive]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Ordered keys of the visible columns, as currently rendered in the header
  const getHeaderCells = () => {
    const row = tableRef.current?.querySelector('thead tr');
    return row ? [...row.children] : [];
  };

  // Swap two columns in the full order array (hidden columns keep their slots)
  const swapColumns = (keyA, keyB) => {
    setColumnOrder(prev => {
      const a = prev.indexOf(keyA);
      const b = prev.indexOf(keyB);
      if (a === -1 || b === -1) return prev;
      const next = [...prev];
      next[a] = keyB;
      next[b] = keyA;
      return next;
    });
  };

  // Resize start: snapshot ALL visible widths to explicit pixels so only the
  // dragged pair can change — nothing else reflows (design D2)
  const handleResizeStart = (e, columnKey) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // never reaches the th: no sort, no reorder
    e.preventDefault();
    const ths = getHeaderCells();
    if (ths.length === 0) return;
    const keys = ths.map(th => th.dataset.columnKey);
    const widths = {};
    ths.forEach((th, i) => { widths[keys[i]] = th.offsetWidth; });
    const rightKey = keys[keys.indexOf(columnKey) + 1]; // next VISIBLE column
    if (!rightKey) return; // last visible column has no pair (and renders no handle)
    setColumnWidths(prev => ({ ...prev, ...widths }));
    gestureRef.current = {
      mode: 'resizing',
      leftKey: columnKey,
      rightKey,
      startX: e.clientX,
      startLeft: widths[columnKey],
      startRight: widths[rightKey]
    };
    setGestureActive(true);
  };

  // Header press: may become a sort (release < threshold) or a reorder drag
  const handleHeaderMouseDown = (e, columnKey) => {
    if (e.button !== 0) return;
    gestureRef.current = { mode: 'pending', columnKey, startX: e.clientX, startY: e.clientY };
    setGestureActive(true);
  };

  // Resolve a plain click as a sort directly on the th (document mouseup is
  // the fallback; the mode guard prevents double-sorting)
  const handleHeaderMouseUp = (e, columnKey) => {
    const g = gestureRef.current;
    if (g.mode === 'pending' && g.columnKey === columnKey) {
      gestureRef.current = { mode: 'idle' };
      setGestureActive(false);
      onSort(columnKey);
    }
  };

  // Document-level tracking while a gesture is in flight
  useEffect(() => {
    if (!gestureActive) return;

    const handleMove = (e) => {
      const g = gestureRef.current;

      if (g.mode === 'pending') {
        if (Math.abs(e.clientX - g.startX) + Math.abs(e.clientY - g.startY) < DRAG_THRESHOLD) return;
        g.mode = 'dragging'; // crossed the threshold: reorder, not sort
      }

      if (g.mode === 'resizing') {
        e.preventDefault();
        // Zero-sum trade between the pair, clamped so neither drops below the
        // minimum. Math.min guards keep degenerate start widths from inverting
        // the clamp range.
        const minLeft = Math.min(MIN_COLUMN_WIDTH, g.startLeft);
        const minRight = Math.min(MIN_COLUMN_WIDTH, g.startRight);
        const diff = Math.min(
          Math.max(e.clientX - g.startX, minLeft - g.startLeft),
          g.startRight - minRight
        );
        setColumnWidths(prev => ({
          ...prev,
          [g.leftKey]: g.startLeft + diff,
          [g.rightKey]: g.startRight - diff
        }));
      } else if (g.mode === 'dragging') {
        e.preventDefault();
        const ths = getHeaderCells();
        const keys = ths.map(th => th.dataset.columnKey);
        const idx = keys.indexOf(g.columnKey);
        if (idx === -1) return;
        // Live-swap when the cursor crosses a neighbor's midpoint (design D4).
        // 'select' is pinned at position 0 and never a swap target.
        const leftTh = ths[idx - 1];
        if (leftTh && keys[idx - 1] !== 'select') {
          const r = leftTh.getBoundingClientRect();
          if (e.clientX < r.left + r.width / 2) {
            swapColumns(g.columnKey, keys[idx - 1]);
            g.startX -= r.width; // keep the lifted header under the cursor after the jump
          }
        }
        const rightTh = ths[idx + 1];
        if (rightTh) {
          const r = rightTh.getBoundingClientRect();
          if (e.clientX > r.left + r.width / 2) {
            swapColumns(g.columnKey, keys[idx + 1]);
            g.startX += r.width;
          }
        }
        setDragVisual({ key: g.columnKey, dx: e.clientX - g.startX });
      } else if (g.mode === 'menu-drag') {
        e.preventDefault();
        // Vertical live-swap of context-menu items — same columnOrder mutation
        // as dragging a header (design D5)
        const items = menuRef.current ? [...menuRef.current.querySelectorAll('[data-menu-key]')] : [];
        const keys = items.map(el => el.dataset.menuKey);
        const idx = keys.indexOf(g.columnKey);
        if (idx === -1) return;
        const above = items[idx - 1];
        if (above) {
          const r = above.getBoundingClientRect();
          if (e.clientY < r.top + r.height / 2) {
            swapColumns(g.columnKey, keys[idx - 1]);
            g.startY -= r.height; // keep the lifted item under the cursor after the jump
          }
        }
        const below = items[idx + 1];
        if (below) {
          const r = below.getBoundingClientRect();
          if (e.clientY > r.top + r.height / 2) {
            swapColumns(g.columnKey, keys[idx + 1]);
            g.startY += r.height;
          }
        }
        setMenuDragVisual({ key: g.columnKey, dy: e.clientY - g.startY });
      }
    };

    const handleUp = () => {
      const g = gestureRef.current;
      if (g.mode === 'pending') {
        onSort(g.columnKey); // released without moving: plain click → sort
      }
      // resizing/dragging/menu-drag: state is already committed; release just ends the gesture
      gestureRef.current = { mode: 'idle' };
      setGestureActive(false);
      setDragVisual(null);
      setMenuDragVisual(null);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [gestureActive, onSort]);

  // Handle column visibility toggle. Name is required-visible, which also
  // guarantees the table never ends up with zero data columns.
  const handleColumnVisibilityToggle = (columnKey) => {
    const column = COLUMNS.find(c => c.key === columnKey);
    if (!column || column.required || column.structural) return;
    if (columnKey === 'claude') {
      claudeTouchedRef.current = true; // explicit choice beats auto-show from now on
    }
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }));
  };

  // Open the column context menu at the cursor, suppressing the native menu
  const handleHeaderContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Begin drag-reordering a context-menu item
  const handleMenuDragStart = (e, columnKey) => {
    if (e.button !== 0) return;
    e.preventDefault();
    gestureRef.current = { mode: 'menu-drag', columnKey, startY: e.clientY };
    setMenuDragVisual({ key: columnKey, dy: 0 });
    setGestureActive(true);
  };

  // Restore default order, visibility, and widths and clear persisted state
  const handleResetLayout = () => {
    suppressPersistRef.current = true; // don't immediately re-persist the defaults
    claudeTouchedRef.current = false; // Claude auto-show is back in effect
    clearTableLayout();
    setColumnOrder(DEFAULT_ORDER);
    setVisibleColumns(defaultVisibleColumns(hookConfigured));
    setColumnWidths({});
    setContextMenu(null);
  };

  // Clamp the context menu into the viewport once it has rendered
  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const x = Math.min(contextMenu.x, Math.max(0, window.innerWidth - rect.width - 8));
    const y = Math.min(contextMenu.y, Math.max(0, window.innerHeight - rect.height - 8));
    if (x !== contextMenu.x || y !== contextMenu.y) {
      setContextMenu({ x, y });
    }
  }, [contextMenu]);

  // Dismiss the context menu on outside click, Escape, or window blur
  useEffect(() => {
    if (!contextMenu) return;
    const handleDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const handleBlur = () => setContextMenu(null);
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('blur', handleBlur);
    };
  }, [contextMenu]);

  // Check if all visible workspaces are selected
  const allSelected = workspaces.length > 0 && workspaces.every(ws => selectedWorkspaces.has(ws.id));
  const someSelected = workspaces.some(ws => selectedWorkspaces.has(ws.id)) && !allSelected;

  // Handle header checkbox change
  const handleHeaderCheckboxChange = (e) => {
    e.stopPropagation();
    console.log('[WorkspaceTable] Header checkbox clicked, current allSelected:', allSelected);
    if (onSelectAll) {
      onSelectAll(!allSelected);
    }
  };

  // Handle row checkbox change
  const handleRowCheckboxChange = (workspaceId, checked) => {
    console.log('[WorkspaceTable] Row checkbox changed:', { workspaceId, checked });
    if (onSelectWorkspace) {
      onSelectWorkspace(workspaceId, checked);
    }
  };

  // Convert workspace path to VS Code URI
  const convertToVSCodeURI = (workspace) => {
    const path = workspace.path;
    const type = workspace.type;

    // Handle remote workspaces - transform vscode-remote:// to vscode://vscode-remote/
    if (type === 'remote' || type === 'dev-container' || type === 'attached-container' || type === 'ssh-remote') {
      // Transform vscode-remote:// URIs to vscode://vscode-remote/ format
      // This is the correct format that VS Code's protocol handler recognizes
      if (path.startsWith('vscode-remote://')) {
        // Replace vscode-remote:// with vscode://vscode-remote/
        return path.replace(/^vscode-remote:\/\//, 'vscode://vscode-remote/');
      }
      // Otherwise, it might be a file:// URI that needs conversion
      // For now, return as-is and let VS Code handle it
      return path;
    }

    // Handle local workspaces
    // Remove file:// prefix if present
    let cleanPath = path;
    if (cleanPath.startsWith('file://')) {
      cleanPath = cleanPath.substring(7);
    }

    // Decode URL-encoded characters (e.g., %20 -> space)
    try {
      cleanPath = decodeURIComponent(cleanPath);
    } catch (e) {
      // If decoding fails, use the original path
      console.warn('Failed to decode path:', cleanPath, e);
    }

    // Encode the path for use in vscode:// URI
    // encodeURIComponent encodes special characters but we need to preserve slashes
    const encodedPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');

    return `vscode://file${encodedPath}`;
  };

  const handleWorkspaceClick = async (e, workspace) => {
    const uri = convertToVSCodeURI(workspace);

    // Check if running in Tauri mode (v2 uses __TAURI_INTERNALS__ instead of __TAURI__)
    const isTauri = typeof window !== 'undefined' && (
      window.__TAURI__ !== undefined ||
      window.__TAURI_INTERNALS__ !== undefined
    );

    console.log('[WorkspaceTable] Click detected:', { uri, isTauri, workspace });

    if (isTauri) {
      // In Tauri, use the shell plugin to open external URLs
      e.preventDefault();
      console.log('[WorkspaceTable] Opening in Tauri mode with URI:', uri);
      try {
        await invoke('open_vscode', { uri });
        console.log('[WorkspaceTable] Successfully invoked open_vscode');
      } catch (error) {
        console.error('[WorkspaceTable] Failed to open VS Code: via invoke:', error);
        // Fallback to shell open
        try {
          console.log('[WorkspaceTable] Trying fallback with shell.open...');
          await open(uri);
          console.log('[WorkspaceTable] Successfully opened via shell.open');
        } catch (fallbackError) {
          console.error('[WorkspaceTable] Fallback also failed:', fallbackError);
        }
      }
      return;
    } else {
      console.log('[WorkspaceTable] Not in Tauri mode, using web fallback');
    }
    
    // For remote workspaces in web mode, we need to use a different approach
    // The vscode://vscode-remote/ URIs require special handling to open in VS Code
    if (workspace.type === 'remote' || workspace.type === 'dev-container' ||
        workspace.type === 'attached-container' || workspace.type === 'ssh-remote') {
      // Prevent default link behavior
      e.preventDefault();
      
      // Try multiple approaches to open the remote workspace
      // Approach 1: Try window.location.href with the transformed vscode://vscode-remote/ URI
      window.location.href = uri;
      
      // Approach 2: If that doesn't work, try opening in a new window
      // This gives the protocol handler another chance to handle it
      setTimeout(() => {
        window.open(uri, '_blank');
      }, 100);
    }
    // For local workspaces, the href will handle it
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  const getTypeLabel = (type) => {
    const labels = {
      'local': 'Local',
      'remote': 'Remote',
      'dev-container': 'Dev Container',
      'attached-container': 'Attached Container',
      'ssh-remote': 'SSH Remote',
      'unknown': 'Unknown'
    };
    return labels[type] || type;
  };

  const getTypeClass = (type) => {
    return `type-badge type-${type}`;
  };

  // Columns resolved through the user's order, filtered to visible ones.
  // Both <thead> and <tbody> render by mapping over this list.
  const orderedColumns = columnOrder
    .map(key => COLUMNS.find(c => c.key === key))
    .filter(Boolean);
  const visibleOrderedColumns = orderedColumns.filter(c => visibleColumns[c.key]);
  // The last visible column renders no resize handle — there is no column to its
  // right to trade width with (design D2)
  const lastVisibleKey = visibleOrderedColumns[visibleOrderedColumns.length - 1]?.key;

  // Calculate visible column count for colSpan
  const visibleColumnCount = visibleOrderedColumns.length;

  // Toggle in-place expansion of a truncated cell; only one cell at a time
  const handleCellExpandToggle = (rowId, columnKey) => {
    setCopied(false);
    setExpandedCell(prev =>
      prev && prev.rowId === rowId && prev.columnKey === columnKey
        ? null
        : { rowId, columnKey }
    );
  };

  const clipboardAvailable =
    typeof navigator !== 'undefined' && !!(navigator.clipboard && navigator.clipboard.writeText);

  // Copy the full cell value; the button shows a transient ✓ confirmation
  const handleCopyCellValue = (e, value) => {
    e.stopPropagation(); // keep the cell expanded
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  // Truncated cell that expands in place on click, with a copy button (design D6)
  const renderExpandableCell = (column, workspace, value, { className, title }) => {
    const isExpanded = !!expandedCell
      && expandedCell.rowId === workspace.id
      && expandedCell.columnKey === column.key;
    return (
      <td
        key={column.key}
        className={`${className}${isExpanded ? ' cell-expanded' : ''}${value ? ' cell-expandable' : ''}`}
        title={isExpanded ? undefined : title}
        onClick={value ? () => handleCellExpandToggle(workspace.id, column.key) : undefined}
      >
        {value}
        {isExpanded && clipboardAvailable && (
          <button
            className="cell-copy-btn"
            title="Copy to clipboard"
            aria-label="Copy to clipboard"
            onClick={(e) => handleCopyCellValue(e, value)}
          >
            {copied ? '✓' : '📋'}
          </button>
        )}
      </td>
    );
  };

  // Render a single body cell for a column/workspace pair
  const renderCell = (column, workspace) => {
    switch (column.key) {
      case 'select':
        return (
          <td key="select" className="checkbox-column" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selectedWorkspaces.has(workspace.id)}
              onChange={(e) => handleRowCheckboxChange(workspace.id, e.target.checked)}
            />
          </td>
        );
      case 'name':
        return (
          <td key="name" className="workspace-name">
            <a
              href={convertToVSCodeURI(workspace)}
              title={workspace.path}
              className="workspace-link"
              onClick={(e) => handleWorkspaceClick(e, workspace)}
            >
              {workspace.name}
              <span className="external-icon" aria-label="Opens in VS Code">↗</span>
            </a>
          </td>
        );
      case 'lastAccessed':
        return <td key="lastAccessed" className="workspace-date">{formatDate(workspace.lastAccessed)}</td>;
      case 'type':
        return (
          <td key="type" className="workspace-type">
            <span className={getTypeClass(workspace.type)}>
              {getTypeLabel(workspace.type)}
            </span>
          </td>
        );
      case 'claude': {
        const wsPath = extractWorkspacePath(workspace) || workspace.path;
        const sessions = sessionMap.get(wsPath) || [];
        if (sessions.length === 0) return <td key="claude" className="workspace-claude" />;
        const workingCount = sessions.filter(s => s.state === 'working').length;
        const waitingCount = sessions.filter(s => s.state === 'waiting').length;
        const idleCount = sessions.filter(s => s.state === 'idle').length;
        return (
          <td key="claude" className="workspace-claude">
            <span className="claude-indicator-group">
              {workingCount > 0 && (
                <span className="claude-indicator claude-indicator-working" title={`${workingCount} working`}>
                  <span className="claude-dot claude-dot-working" />
                  <span className="claude-count">{workingCount}</span>
                </span>
              )}
              {waitingCount > 0 && (
                <span className="claude-indicator claude-indicator-waiting" title={`${waitingCount} waiting for approval`}>
                  <span className="claude-dot claude-dot-waiting" />
                  <span className="claude-count">{waitingCount}</span>
                </span>
              )}
              {idleCount > 0 && (
                <span className="claude-indicator claude-indicator-idle" title={`${idleCount} idle`}>
                  <span className="claude-dot claude-dot-idle" />
                  <span className="claude-count">{idleCount}</span>
                </span>
              )}
            </span>
          </td>
        );
      }
      case 'connection': {
        const connInfo = extractConnectionInfo(workspace);
        return renderExpandableCell(column, workspace, connInfo.display, {
          className: `workspace-connection${connInfo.error ? ' workspace-connection-error' : ''}`,
          title: connInfo.raw || connInfo.display
        });
      }
      case 'workspacePath': {
        const extracted = extractWorkspacePath(workspace);
        return renderExpandableCell(column, workspace, extracted, {
          className: 'workspace-extracted-path',
          title: extracted
        });
      }
      case 'path':
        return renderExpandableCell(column, workspace, workspace.path, {
          className: 'workspace-path',
          title: workspace.path
        });
      default:
        return null;
    }
  };

  return (
    <div className="workspace-table-container">
      <table className="workspace-table" ref={tableRef}>
        <thead>
          <tr onContextMenu={handleHeaderContextMenu}>
            {visibleOrderedColumns.map(column => column.structural ? (
              <th key="select" className="checkbox-column" data-column-key="select" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={input => {
                    if (input) {
                      input.indeterminate = someSelected;
                    }
                  }}
                  onChange={handleHeaderCheckboxChange}
                  title={allSelected ? 'Deselect all' : 'Select all'}
                />
              </th>
            ) : (
              <th
                key={column.key}
                data-column-key={column.key}
                onMouseDown={(e) => handleHeaderMouseDown(e, column.key)}
                onMouseUp={(e) => handleHeaderMouseUp(e, column.key)}
                className={`sortable${dragVisual && dragVisual.key === column.key ? ' th-dragging' : ''}`}
                style={{
                  width: columnWidths[column.key] || 'auto',
                  transform: dragVisual && dragVisual.key === column.key
                    ? `translateX(${dragVisual.dx}px)`
                    : undefined
                }}
              >
                {column.label}{getSortIndicator(column.key)}
                {column.key !== lastVisibleKey && (
                  <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, column.key)} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {workspaces.length === 0 ? (
            <tr>
              <td colSpan={visibleColumnCount} className="no-results">
                No workspaces found
              </td>
            </tr>
          ) : (
            workspaces.map((workspace) => {
              const isInvalid = validationStatus[workspace.id] === false;

              return (
                <tr
                  key={workspace.id}
                  className={isInvalid ? 'workspace-row-invalid' : ''}
                >
                  {visibleOrderedColumns.map(column => renderCell(column, workspace))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {contextMenu && (
        <div
          className="column-menu column-context-menu"
          ref={menuRef}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {orderedColumns.filter(c => !c.structural).map(column => (
            <div
              key={column.key}
              data-menu-key={column.key}
              className={`column-menu-item${menuDragVisual && menuDragVisual.key === column.key ? ' menu-item-dragging' : ''}`}
              style={menuDragVisual && menuDragVisual.key === column.key
                ? { transform: `translateY(${menuDragVisual.dy}px)` }
                : undefined}
            >
              <span
                className="column-drag-handle"
                title="Drag to reorder"
                onMouseDown={(e) => handleMenuDragStart(e, column.key)}
              >
                ≡
              </span>
              <label className="column-menu-label">
                <input
                  type="checkbox"
                  checked={!!visibleColumns[column.key]}
                  disabled={!!column.required}
                  onChange={() => handleColumnVisibilityToggle(column.key)}
                />
                <span>{column.label}</span>
                {column.required && <span className="column-lock" title="Always visible">🔒</span>}
              </label>
            </div>
          ))}
          <div className="column-menu-separator" />
          <button className="column-menu-reset" onClick={handleResetLayout}>
            Reset columns
          </button>
        </div>
      )}
    </div>
  );
}

export default WorkspaceTable;
