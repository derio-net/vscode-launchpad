import React from 'react';
import { ask } from '@tauri-apps/plugin-dialog';
import './ClaudeHookControl.css';

const ACTIONS = {
  'not-installed': { label: 'Enable Claude Code status', title: 'Show live Claude Code session status per workspace' },
  'needs-repair': { label: 'Repair Claude Code status', title: 'Re-install the Claude Code hooks' },
  installed: { label: 'Disable Claude Code status', title: 'Remove the LaunchPad hooks from Claude Code' },
};

/**
 * Enable / Repair / Disable button for LaunchPad's Claude Code hook.
 * Hidden while the status is unknown or unsupported (Windows, containers).
 */
function ClaudeHookControl({ hookStatus, busy, error, onInstall, onRemove }) {
  const status = hookStatus && hookStatus.status;
  const action = ACTIONS[status];
  if (!action) return null;

  const handleClick = async () => {
    if (status !== 'installed') {
      onInstall();
      return;
    }
    const confirmed = await ask(
      'Remove the LaunchPad hooks from Claude Code?\n\nThe Claude column and session status will be hidden. Other hooks in ~/.claude/settings.json are kept.',
      { title: 'Disable Claude Code status', kind: 'warning' },
    );
    if (confirmed) onRemove();
  };

  return (
    <div className="claude-hook-control">
      <button
        type="button"
        className={`claude-hook-button claude-hook-button--${status}`}
        onClick={handleClick}
        disabled={busy}
        title={action.title}
      >
        {busy ? 'Working…' : action.label}
      </button>
      {error && (
        <span className="claude-hook-error" role="alert">{error}</span>
      )}
    </div>
  );
}

export default ClaudeHookControl;
