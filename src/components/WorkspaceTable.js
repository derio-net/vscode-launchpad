import React from 'react';
import './WorkspaceTable.css';

function WorkspaceTable({ workspaces, sortConfig, onSort }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Convert workspace path to VS Code URI
  const convertToVSCodeURI = (workspace) => {
    const path = workspace.path;
    const type = workspace.type;

    // Handle remote workspaces - preserve existing vscode-remote:// URIs
    if (type === 'remote' || type === 'dev-container' || type === 'attached-container' || type === 'ssh-remote') {
      // If path already starts with vscode-remote://, use it as-is
      if (path.startsWith('vscode-remote://')) {
        return path;
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
    // since vscode-remote:// URIs don't work as href directly
    if (workspace.type === 'remote' || workspace.type === 'dev-container' || 
        workspace.type === 'attached-container' || workspace.type === 'ssh-remote') {
      // Prevent default link behavior
      e.preventDefault();
      
      // Try multiple approaches to open the remote workspace
      // Approach 1: Try window.location.href
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

  return (
    <div className="workspace-table-container">
      <table className="workspace-table">
        <thead>
          <tr>
            <th onClick={() => onSort('name')} className="sortable">
              Name{getSortIndicator('name')}
            </th>
            <th onClick={() => onSort('lastModified')} className="sortable">
              Last Modified{getSortIndicator('lastModified')}
            </th>
            <th onClick={() => onSort('type')} className="sortable">
              Type{getSortIndicator('type')}
            </th>
            <th onClick={() => onSort('path')} className="sortable">
              Path{getSortIndicator('path')}
            </th>
          </tr>
        </thead>
        <tbody>
          {workspaces.length === 0 ? (
            <tr>
              <td colSpan="4" className="no-results">
                No workspaces found
              </td>
            </tr>
          ) : (
            workspaces.map((workspace) => (
              <tr key={workspace.id}>
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
                <td className="workspace-date">{formatDate(workspace.lastModified)}</td>
                <td className="workspace-type">
                  <span className={getTypeClass(workspace.type)}>
                    {getTypeLabel(workspace.type)}
                  </span>
                </td>
                <td className="workspace-path" title={workspace.path}>
                  {workspace.path}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default WorkspaceTable;
