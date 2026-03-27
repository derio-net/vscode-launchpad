import React, { useState, useMemo, useEffect, useCallback } from 'react';
import WorkspaceTable from './WorkspaceTable';
import SearchFilter from './SearchFilter';
import { validatePaths, deleteWorkspaces } from '../api/client';
import { ask } from '@tauri-apps/plugin-dialog';
import { extractConnectionInfo, extractWorkspacePath } from '../utils/workspaceUtils';
import './Dashboard.css';

// Emit workspaces-changed event to notify tray menu
const emitWorkspacesChanged = async () => {
  try {
    if (window.__TAURI__) {
      const { emit } = await import('@tauri-apps/api/event');
      await emit('workspaces-changed');
    }
  } catch (e) {
    // Silently ignore in non-Tauri environments
  }
};

function Dashboard({ workspaces, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'lastAccessed', direction: 'desc' });
  const [validationStatus, setValidationStatus] = useState({}); // Map of workspace id to isValid
  const [selectedWorkspaces, setSelectedWorkspaces] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState(null);

  // Filter and sort workspaces
  const filteredAndSortedWorkspaces = useMemo(() => {
    let filtered = workspaces;

    // Apply search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(ws =>
        ws.name.toLowerCase().includes(lowerSearch) ||
        ws.path.toLowerCase().includes(lowerSearch)
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(ws => ws.type === typeFilter);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;

      // Handle computed columns
      if (sortConfig.key === 'connection') {
        aValue = extractConnectionInfo(a).display;
        bValue = extractConnectionInfo(b).display;
      } else if (sortConfig.key === 'workspacePath') {
        aValue = extractWorkspacePath(a);
        bValue = extractWorkspacePath(b);
      } else {
        aValue = a[sortConfig.key];
        bValue = b[sortConfig.key];
      }

      // Handle date sorting
      if (sortConfig.key === 'lastAccessed') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else {
        // String sorting (case-insensitive)
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [workspaces, searchTerm, typeFilter, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
  };

  // Validate workspace paths when workspaces change
  useEffect(() => {
    let isMounted = true;

    const validateWorkspacePaths = async () => {
      if (workspaces.length === 0 || !isMounted) return;

      // Only validate local workspaces (skip remote URLs)
      const localWorkspaces = workspaces.filter(ws => {
        const path = ws.path || '';
        // Skip validation for remote URLs
        if (path.startsWith('http://') || 
            path.startsWith('https://') ||
            path.startsWith('vscode://') ||
            path.startsWith('vscode-remote://')) {
          return false;
        }
        return ws.type === 'local';
      });

      if (localWorkspaces.length === 0) return;

      try {
        const workspacesToValidate = localWorkspaces.map(ws => ({
          id: ws.id,
          path: ws.path
        }));

        const response = await validatePaths(workspacesToValidate);
        
        if (isMounted) {
          setValidationStatus(response.results || {});
        }
      } catch (error) {
        console.error('Failed to validate workspace paths:', error);
      }
    };

    validateWorkspacePaths();

    return () => {
      isMounted = false;
    };
  }, [workspaces]);

  // Selection handlers
  const handleSelectWorkspace = useCallback((workspaceId, isSelected) => {
    console.log('[Dashboard] handleSelectWorkspace called:', { workspaceId, isSelected });
    setSelectedWorkspaces(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(workspaceId);
      } else {
        newSet.delete(workspaceId);
      }
      console.log('[Dashboard] Updated selected workspaces:', Array.from(newSet));
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((isSelected) => {
    if (isSelected) {
      setSelectedWorkspaces(new Set(filteredAndSortedWorkspaces.map(ws => ws.id)));
    } else {
      setSelectedWorkspaces(new Set());
    }
  }, [filteredAndSortedWorkspaces]);

  // Delete handlers
  const handleDeleteClick = async () => {
    console.log('[Dashboard] Delete button clicked');
    console.log('[Dashboard] Selected workspaces count:', selectedWorkspaces.size);
    console.log('[Dashboard] Selected workspaces:', Array.from(selectedWorkspaces));

    if (selectedWorkspaces.size === 0) {
      console.log('[Dashboard] No workspaces selected, returning early');
      return;
    }

    const selectedList = workspaces.filter(ws => selectedWorkspaces.has(ws.id));
    const names = selectedList.map(ws => ws.name).join('\n  - ');

    console.log('[Dashboard] Selected workspace names:', names);
    console.log('[Dashboard] About to show confirmation dialog');

    const confirmed = await ask(
      `Are you sure you want to delete ${selectedWorkspaces.size} workspace(s) from your Path?\n\n` +
      `This will remove the following workspace references:\n  - ${names}\n\n` +
      `Note: This only removes the workspace reference from VS Code:'s history. ` +
      `Your actual project files will NOT be deleted.`,
      {
        title: 'Delete Workspaces',
        kind: 'warning'
      }
    );

    console.log('[Dashboard] Confirmation result:', confirmed);

    if (confirmed) {
      console.log('[Dashboard] User confirmed, calling performDelete');
      performDelete();
    } else {
      console.log('[Dashboard] User cancelled deletion');
    }
  };

  const performDelete = async () => {
    console.log('[Dashboard] performDelete called');
    console.log('[Dashboard] Workspace IDs to delete:', Array.from(selectedWorkspaces));
    
    setIsDeleting(true);
    try {
      console.log('[Dashboard] Calling deleteWorkspaces API...');
      const result = await deleteWorkspaces(Array.from(selectedWorkspaces));
      console.log('[Dashboard] Delete API result:', result);
      
      if (result.success) {
        setNotification({
          type: 'success',
          message: `Successfully removed ${result.removed} workspace(s) from Path`
        });
        setSelectedWorkspaces(new Set());
        // Refresh the workspace list
        if (onRefresh) {
          console.log('[Dashboard] Calling onRefresh to update workspace list');
          onRefresh();
        }
        // Notify tray menu to update
        emitWorkspacesChanged();
      } else {
        console.error('[Dashboard] Delete failed:', result.errors);
        setNotification({
          type: 'error',
          message: `Failed to remove workspaces: ${result.errors?.join(', ') || 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error('[Dashboard] Delete error:', error);
      setNotification({
        type: 'error',
        message: `Failed to delete workspaces: ${error.message}`
      });
    } finally {
      setIsDeleting(false);
      // Clear notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Get unique workspace types for filter
  const workspaceTypes = useMemo(() => {
    const types = new Set(workspaces.map(ws => ws.type));
    return ['all', ...Array.from(types).sort()];
  }, [workspaces]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>VS Code Launchpad</h1>
        <p className="workspace-count">
          {filteredAndSortedWorkspaces.length} of {workspaces.length} workspaces
          {selectedWorkspaces.size > 0 && (
            <span className="selection-count"> ({selectedWorkspaces.size} selected)</span>
          )}
        </p>
        <div className="info-banner">
          <span className="info-icon">ℹ️</span>
          <p className="info-text">
            Click on any workspace name to open it in VS Code. 
            <span className="info-note">Note: VS Code must be installed and your browser may show a security prompt the first time.</span>
          </p>
        </div>
      </header>

      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="dashboard-toolbar">
        <SearchFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          workspaceTypes={workspaceTypes}
          onClear={handleClearFilters}
        />
        <button
          className="delete-button"
          onClick={handleDeleteClick}
          disabled={selectedWorkspaces.size === 0 || isDeleting}
          title={selectedWorkspaces.size === 0 ? 'Select workspaces to delete' : `Delete ${selectedWorkspaces.size} workspace(s)`}
        >
          {isDeleting ? 'Deleting...' : `Delete${selectedWorkspaces.size > 0 ? ` (${selectedWorkspaces.size})` : ''}`}
        </button>
      </div>

      <WorkspaceTable
        workspaces={filteredAndSortedWorkspaces}
        sortConfig={sortConfig}
        onSort={handleSort}
        validationStatus={validationStatus}
        selectedWorkspaces={selectedWorkspaces}
        onSelectWorkspace={handleSelectWorkspace}
        onSelectAll={handleSelectAll}
      />
    </div>
  );
}

export default Dashboard;
