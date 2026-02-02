import React, { useState, useMemo } from 'react';
import WorkspaceTable from './WorkspaceTable';
import SearchFilter from './SearchFilter';
import './Dashboard.css';

function Dashboard({ workspaces, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'lastModified', direction: 'desc' });

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
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle date sorting
      if (sortConfig.key === 'lastModified') {
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

  // Get unique workspace types for filter
  const workspaceTypes = useMemo(() => {
    const types = new Set(workspaces.map(ws => ws.type));
    return ['all', ...Array.from(types).sort()];
  }, [workspaces]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>VS Code Workspace Dashboard</h1>
        <p className="workspace-count">
          {filteredAndSortedWorkspaces.length} of {workspaces.length} workspaces
        </p>
        <div className="info-banner">
          <span className="info-icon">ℹ️</span>
          <p className="info-text">
            Click on any workspace name to open it in VS Code. 
            <span className="info-note">Note: VS Code must be installed and your browser may show a security prompt the first time.</span>
          </p>
        </div>
      </header>

      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        workspaceTypes={workspaceTypes}
        onClear={handleClearFilters}
      />

      <WorkspaceTable
        workspaces={filteredAndSortedWorkspaces}
        sortConfig={sortConfig}
        onSort={handleSort}
      />
    </div>
  );
}

export default Dashboard;
