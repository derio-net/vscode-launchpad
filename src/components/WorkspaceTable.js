import React, { useState, useRef, useEffect } from 'react';
import './WorkspaceTable.css';
import { open } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { extractConnectionInfo, extractWorkspacePath } from '../utils/workspaceUtils';
import { getAggregateState } from '../hooks/useClaudeSessions';

const COLUMNS = [
  { key: 'select', label: '' },
  { key: 'name', label: 'Name' },
  { key: 'lastAccessed', label: 'Last Accessed' },
  { key: 'type', label: 'Type' },
  { key: 'claude', label: 'Claude' },
  { key: 'connection', label: 'Connection' },
  { key: 'workspacePath', label: 'Path' },
  { key: 'path', label: 'Full Path' }
];

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
  const [columnWidths, setColumnWidths] = useState({});
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCompleted, setResizeCompleted] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    select: true,
    name: true,
    lastAccessed: true,
    type: true,
    claude: hookConfigured,
    connection: true,
    workspacePath: true,
    path: false // Hidden by default as it's verbose
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Sync Claude column visibility when hookConfigured changes to true (auto-show only)
  useEffect(() => {
    if (hookConfigured) {
      setVisibleColumns(prev => ({ ...prev, claude: true }));
    }
  }, [hookConfigured]);

  const resizingColumn = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Handle column resize start
  const handleResizeStart = (e, columnKey) => {
    e.stopPropagation(); // Prevent sorting when resizing
    setIsResizing(true);
    resizingColumn.current = columnKey;
    startX.current = e.clientX;
    const th = e.target.closest('th');
    startWidth.current = th.offsetWidth;
  };

  // Handle column resize move
  const handleResizeMove = (e) => {
    if (!isResizing || !resizingColumn.current) return;
    
    const diff = e.clientX - startX.current;
    const newWidth = Math.max(100, startWidth.current + diff);
    
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn.current]: newWidth
    }));
  };

  // Handle column resize end
  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizeCompleted(true);
    resizingColumn.current = null;
    
    // Clear the resize completed flag after a short delay
    setTimeout(() => {
      setResizeCompleted(false);
    }, 100);
  };

  // Add event listeners for resize
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing]);

  // Handle header click - only sort if not resizing and resize just completed
  const handleHeaderClick = (columnKey) => {
    if (!isResizing && !resizeCompleted) {
      onSort(columnKey);
    }
  };

  // Handle column visibility toggle
  const handleColumnVisibilityToggle = (columnKey) => {
    setVisibleColumns(prev => {
      const newVisible = { ...prev, [columnKey]: !prev[columnKey] };
      // Ensure at least one column remains visible (excluding select column)
      const visibleCount = Object.entries(newVisible).filter(([key, val]) => key !== 'select' && val).length;
      if (visibleCount === 0) {
        return prev; // Don't allow hiding all columns
      }
      return newVisible;
    });
  };

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

  // Calculate visible column count for colSpan
  const visibleColumnCount = Object.values(visibleColumns).filter(Boolean).length;

  return (
    <div className="workspace-table-container">
      <div className="table-controls">
        <div className="column-visibility-dropdown">
          <button
            className="column-toggle-btn"
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            title="Toggle column visibility"
          >
            Columns ▼
          </button>
          {showColumnMenu && (
            <div className="column-menu">
              {COLUMNS.map(column => (
                <label key={column.key} className="column-menu-item">
                  <input
                    type="checkbox"
                    checked={visibleColumns[column.key]}
                    onChange={() => handleColumnVisibilityToggle(column.key)}
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      <table className="workspace-table">
        <thead>
          <tr>
            {visibleColumns.select && (
              <th className="checkbox-column" onClick={(e) => e.stopPropagation()}>
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
            )}
            {visibleColumns.name && (
              <th
                onClick={() => handleHeaderClick('name')}
                className="sortable"
                style={{ width: columnWidths.name || 'auto' }}
              >
                Name{getSortIndicator('name')}
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'name')} />
              </th>
            )}
            {visibleColumns.lastAccessed && (
              <th
                onClick={() => handleHeaderClick('lastAccessed')}
                className="sortable"
                style={{ width: columnWidths.lastAccessed || 'auto' }}
              >
                Last Accessed{getSortIndicator('lastAccessed')}
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'lastAccessed')} />
              </th>
            )}
            {visibleColumns.type && (
              <th
                onClick={() => handleHeaderClick('type')}
                className="sortable"
                style={{ width: columnWidths.type || 'auto' }}
              >
                Type{getSortIndicator('type')}
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'type')} />
              </th>
            )}
            {visibleColumns.claude && (
              <th
                onClick={() => handleHeaderClick('claude')}
                className="sortable"
                style={{ width: columnWidths.claude || 'auto' }}
              >
                Claude{getSortIndicator('claude')}
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'claude')} />
              </th>
            )}
            {visibleColumns.connection && (
              <th
                onClick={() => handleHeaderClick('connection')}
                className="sortable"
                style={{ width: columnWidths.connection || 'auto' }}
              >
                Connection{getSortIndicator('connection')}
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'connection')} />
              </th>
            )}
            {visibleColumns.workspacePath && (
              <th
                onClick={() => handleHeaderClick('workspacePath')}
                className="sortable"
                style={{ width: columnWidths.workspacePath || 'auto' }}
              >
                Path{getSortIndicator('workspacePath')}
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'workspacePath')} />
              </th>
            )}
            {visibleColumns.path && (
              <th
                onClick={() => handleHeaderClick('path')}
                className="sortable"
                style={{ width: columnWidths.path || 'auto' }}
              >
                Full Path{getSortIndicator('path')}
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'path')} />
              </th>
            )}
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
              const isValid = validationStatus[workspace.id] !== false; // undefined = not checked yet, true = valid
              const isInvalid = validationStatus[workspace.id] === false;
              const isSelected = selectedWorkspaces.has(workspace.id);
              
              return (
                <tr 
                  key={workspace.id} 
                  className={isInvalid ? 'workspace-row-invalid' : ''}
                >
                  {visibleColumns.select && (
                    <td className="checkbox-column" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleRowCheckboxChange(workspace.id, e.target.checked)}
                      />
                    </td>
                  )}
                  {visibleColumns.name && (
                    <td className="workspace-name">
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
                  )}
                {visibleColumns.lastAccessed && (
                  <td className="workspace-date">{formatDate(workspace.lastAccessed)}</td>
                )}
                {visibleColumns.type && (
                  <td className="workspace-type">
                    <span className={getTypeClass(workspace.type)}>
                      {getTypeLabel(workspace.type)}
                    </span>
                  </td>
                )}
                {visibleColumns.claude && (
                  (() => {
                    const wsPath = extractWorkspacePath(workspace) || workspace.path;
                    const sessions = sessionMap.get(wsPath) || [];
                    if (sessions.length === 0) return <td className="workspace-claude" />;
                    const workingCount = sessions.filter(s => s.state === 'working').length;
                    const waitingCount = sessions.filter(s => s.state === 'waiting').length;
                    const idleCount = sessions.filter(s => s.state === 'idle').length;
                    return (
                      <td className="workspace-claude">
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
                  })()
                )}
                {visibleColumns.connection && (
                  (() => {
                    const connInfo = extractConnectionInfo(workspace);
                    return (
                      <td
                        className={`workspace-connection${connInfo.error ? ' workspace-connection-error' : ''}`}
                        title={connInfo.raw || connInfo.display}
                      >
                        {connInfo.display}
                      </td>
                    );
                  })()
                )}
                {visibleColumns.workspacePath && (
                  <td className="workspace-extracted-path" title={extractWorkspacePath(workspace)}>
                    {extractWorkspacePath(workspace)}
                  </td>
                )}
                {visibleColumns.path && (
                  <td className="workspace-path" title={workspace.path}>
                    {workspace.path}
                  </td>
                )}
              </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default WorkspaceTable;
