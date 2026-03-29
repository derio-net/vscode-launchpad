import React, { useState } from 'react';
import { killClaudeSessions } from '../api/client';
import { ask } from '@tauri-apps/plugin-dialog';
import './ClaudeSessionSummary.css';

function formatAge(startedAt) {
  if (!startedAt) return '?';
  const ms = Date.now() - startedAt;
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function ClaudeSessionSummary({ summary, zombies = [], claudeFilter, onFilterChange }) {
  const [killingPids, setKillingPids] = useState(new Set());

  const hasLiveSessions = summary && summary.total > 0;
  const hasZombies = zombies.length > 0;

  if (!hasLiveSessions && !hasZombies) return null;

  const handleKill = async (pids) => {
    const count = pids.length;
    const confirmed = await ask(
      `Kill ${count} zombie Claude session${count !== 1 ? 's' : ''}?\n\nThis will terminate the orphaned process${count !== 1 ? 'es' : ''}.`,
      { title: 'Kill Zombie Sessions', kind: 'warning' }
    );
    if (!confirmed) return;

    setKillingPids(prev => new Set([...prev, ...pids]));
    try {
      await killClaudeSessions(pids);
    } catch (err) {
      console.error('Failed to kill sessions:', err);
    }
    // PIDs will disappear on next poll cycle
  };

  return (
    <div className="claude-summary">
      {hasLiveSessions && (
        <div className="claude-summary-live">
          <div className="claude-summary-icon">⚡</div>
          <div className="claude-summary-text">
            <span className="claude-summary-label">Claude:</span>
            <span className="claude-summary-count">{summary.total} session{summary.total !== 1 ? 's' : ''}</span>
            {summary.working > 0 && (
              <button
                className={`claude-summary-btn claude-summary-working ${claudeFilter === 'working' ? 'claude-summary-btn-active' : ''}`}
                onClick={() => onFilterChange(claudeFilter === 'working' ? null : 'working')}
                title={claudeFilter === 'working' ? 'Clear filter' : 'Show only workspaces with working sessions'}
              >
                <span className="claude-dot claude-dot-working" />
                {summary.working} working
              </button>
            )}
            {summary.waiting > 0 && (
              <button
                className={`claude-summary-btn claude-summary-waiting ${claudeFilter === 'waiting' ? 'claude-summary-btn-active' : ''}`}
                onClick={() => onFilterChange(claudeFilter === 'waiting' ? null : 'waiting')}
                title={claudeFilter === 'waiting' ? 'Clear filter' : 'Show only workspaces with waiting sessions'}
              >
                <span className="claude-dot claude-dot-waiting" />
                {summary.waiting} waiting
              </button>
            )}
            {summary.idle > 0 && (
              <span className="claude-summary-idle-text">
                <span className="claude-dot claude-dot-idle" />
                {summary.idle} idle
              </span>
            )}
          </div>
        </div>
      )}

      {hasZombies && (
        <div className="claude-summary-zombies">
          <div className="claude-zombie-header">
            <span className="claude-zombie-icon">💀</span>
            <span className="claude-zombie-count">{zombies.length} zombie{zombies.length !== 1 ? 's' : ''}</span>
            {zombies.length > 1 && (
              <button
                className="claude-zombie-kill-all"
                onClick={() => handleKill(zombies.map(z => z.pid))}
                title="Kill all zombie sessions"
              >
                Kill All
              </button>
            )}
          </div>
          <div className="claude-zombie-list">
            {zombies.map(z => {
              const name = z.cwd.split('/').filter(Boolean).pop() || z.cwd;
              const isKilling = killingPids.has(z.pid);
              return (
                <div key={z.pid} className={`claude-zombie-item ${isKilling ? 'claude-zombie-killing' : ''}`}>
                  <span className="claude-zombie-name">{name}</span>
                  <span className="claude-zombie-age">{formatAge(z.startedAt)}</span>
                  <span className="claude-zombie-pid">PID {z.pid}</span>
                  <button
                    className="claude-zombie-kill"
                    onClick={() => handleKill([z.pid])}
                    disabled={isKilling}
                    title={`Kill PID ${z.pid}`}
                  >
                    {isKilling ? '...' : '✕'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ClaudeSessionSummary;
