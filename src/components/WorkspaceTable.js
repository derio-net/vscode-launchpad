import React, { useState, useRef } from 'react';
import './WorkspaceTable.css';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'lastModified', label: 'Last Modified' },
  { key: 'type', label: 'Type' },
  { key: 'sshHost', label: 'SSH Host' },
  { key: 'workspacePath', label: 'Path' },
  { key: 'path', label: 'Full Path' }
];

function WorkspaceTable({ workspaces, sortConfig, onSort }) {
  const [columnWidths, setColumnWidths] = useState({});
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCompleted, setResizeCompleted] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    lastModified: true,
    type: true,
    sshHost: true,
    workspacePath: true,
    path: false // Hidden by default as it's verbose
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
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
      // Ensure at least one column remains visible
      const visibleCount = Object.values(newVisible).filter(Boolean).length;
      if (visibleCount === 0) {
        return prev; // Don't allow hiding all columns
      }
      return newVisible;
    });
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

  const handleWorkspaceClick = (e, workspace) => {
    const uri = convertToVSCodeURI(workspace);
    
    // For remote workspaces, we need to use a different approach
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

  // Extract SSH host from remote workspace URI
  const extractSSHHost = (workspace) => {
    const path = workspace.path;
    const type = workspace.type;
    
    if (type === 'ssh-remote' && path.includes('ssh-remote')) {
      // Handle URL-encoded format: vscode-remote://ssh-remote%2Bhost/path
      const encodedMatch = path.match(/ssh-remote%2B([^/]+)/);
      if (encodedMatch) {
        return decodeURIComponent(encodedMatch[1]);
      }
      // Handle vscode://vscode-remote/ssh-remote+host@/path format
      const match = path.match(/ssh-remote\+([^@/]+)/);
      if (match) {
        return match[1];
      }
    }
    return '';
  };

  // Extract workspace path from URI
  const extractWorkspacePath = (workspace) => {
    const path = workspace.path;
    const type = workspace.type;
    
    if (type === 'local') {
      // Remove file:// prefix and decode
      let cleanPath = path;
      if (cleanPath.startsWith('file://')) {
        cleanPath = cleanPath.substring(7);
      }
      try {
        return decodeURIComponent(cleanPath);
      } catch (e) {
        return cleanPath;
      }
    } else if (type === 'ssh-remote') {
      // Extract path after the host for SSH remotes
      // Handle URL-encoded format: vscode-remote://ssh-remote%2Bhost/path
      const encodedMatch = path.match(/ssh-remote%2B[^/]+(.+)$/);
      if (encodedMatch) {
        return encodedMatch[1];
      }
      // Handle vscode://vscode-remote/ssh-remote+host@/path format
      const match = path.match(/ssh-remote\+[^@/]+@?(.+)$/);
      if (match) {
        return match[1];
      }
      return path;
    } else if (type === 'dev-container' || type === 'attached-container') {
      // For containers, try to extract the path portion
      const match = path.match(/\+[^/]+(\/.*)$/);
      if (match) {
        return match[1];
      }
      return path;
    }
    return path;
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
            {visibleColumns.lastModified && (
              <th
                onClick={() => handleHeaderClick('lastModified')}
                className="sortable"
                style={{ width: columnWidths.lastModified || 'auto' }}
              >
                Last Modified{getSortIndicator('lastModified')}
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'lastModified')} />
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
            {visibleColumns.sshHost && (
              <th
                onClick={() => handleHeaderClick('sshHost')}
                className="sortable"
                style={{ width: columnWidths.sshHost || 'auto' }}
              >
                SSH Host{getSortIndicator('sshHost')}
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'sshHost')} />
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
            workspaces.map((workspace) => (
              <tr key={workspace.id}>
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
                {visibleColumns.lastModified && (
                  <td className="workspace-date">{formatDate(workspace.lastModified)}</td>
                )}
                {visibleColumns.type && (
                  <td className="workspace-type">
                    <span className={getTypeClass(workspace.type)}>
                      {getTypeLabel(workspace.type)}
                    </span>
                  </td>
                )}
                {visibleColumns.sshHost && (
                  <td className="workspace-ssh-host" title={extractSSHHost(workspace)}>
                    {extractSSHHost(workspace)}
                  </td>
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
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default WorkspaceTable;
