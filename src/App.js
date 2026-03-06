import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import { getWorkspaces, waitForApi, getDiagnostics } from './api/client';
import './App.css';

function DiagnosticsPanel() {
  const [diagnostics, setDiagnostics] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const data = await getDiagnostics();
      setDiagnostics(data);
      setExpanded(true);
    } catch (e) {
      setDiagnostics({ error: e.toString() });
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  };

  if (!expanded) {
    return (
      <button
        className="diagnostics-toggle"
        onClick={runDiagnostics}
        disabled={loading}
      >
        {loading ? 'Running diagnostics...' : 'Show Diagnostics'}
      </button>
    );
  }

  return (
    <div className="diagnostics-panel">
      <div className="diagnostics-header">
        <span>Diagnostics</span>
        <button className="diagnostics-close" onClick={() => setExpanded(false)}>
          Hide
        </button>
      </div>
      <div className="diagnostics-grid">
        {diagnostics && Object.entries(diagnostics).map(([key, value]) => (
          <React.Fragment key={key}>
            <span className="diagnostics-key">{key}</span>
            <span className={`diagnostics-value ${
              value === true ? 'diagnostics-ok' :
              value === false ? 'diagnostics-fail' : ''
            }`}>
              {typeof value === 'boolean' ? (value ? 'OK' : 'FAIL') : String(value)}
            </span>
          </React.Fragment>
        ))}
      </div>
      <button className="diagnostics-toggle" onClick={runDiagnostics} disabled={loading}>
        {loading ? 'Running...' : 'Refresh'}
      </button>
    </div>
  );
}

function App() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Fetch workspaces from API
  const fetchWorkspaces = async () => {
    if (isFetching) {
      console.log('Already fetching workspaces, skipping...');
      return;
    }

    console.log('Starting fetchWorkspaces...');
    try {
      setIsFetching(true);
      const data = await getWorkspaces();
      console.log('Workspaces fetched:', data.length);
      setWorkspaces(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching workspaces:', err);
      setError(`Failed to load workspaces: ${err.message || 'Unknown error'}. Please try again.`);
    } finally {
      setLoading(false);
      setIsFetching(false);
      console.log('fetchWorkspaces complete');
    }
  };

  // Memoize fetchWorkspaces to avoid infinite loop in Dashboard useEffect
  const handleRefresh = React.useCallback(() => {
    fetchWorkspaces();
  }, []);

  // Memoize workspaces to ensure stable reference for Dashboard's useEffect
  const memoizedWorkspaces = React.useMemo(() => workspaces, [workspaces]);

  // Wait for sidecar API then fetch workspaces on initial load
  useEffect(() => {
    const init = async () => {
      const ready = await waitForApi(15000, 500);
      if (ready) {
        fetchWorkspaces();
      } else {
        setLoading(false);
        setError('Failed to load workspaces: Backend service did not start in time. Please try again.');
      }
    };
    init();
  }, [retryCount]);

  // Handle retry button click
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setLoading(true);
    setError(null);
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading workspaces...</div>
          <div className="loading-subtext">Connecting to backend service</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error}</div>
          <button className="retry-button" onClick={handleRetry}>
            Retry Connection
          </button>
          <DiagnosticsPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Dashboard workspaces={memoizedWorkspaces} onRefresh={handleRefresh} />
    </div>
  );
}

export default App;
