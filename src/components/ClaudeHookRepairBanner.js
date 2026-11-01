import React, { useState } from 'react';
import './ClaudeHookControl.css';

const STORAGE_KEY = 'launchpad.claudeHookBannerDismissed';

// A dismissal applies to one specific problem; a different reason shows the banner again
const signatureOf = (hookStatus) => `${hookStatus.status}:${hookStatus.reason || ''}`;

const readDismissed = () => {
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
};
const writeDismissed = (value) => {
  try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* storage blocked: dismiss for this session only */ }
};

/**
 * Shown only when the hooks are broken (`needs-repair`): a broken hook makes
 * Claude Code print a hook error on every turn, so this one is worth a banner.
 * A plain `not-installed` gets no banner; the feature is opt-in.
 */
function ClaudeHookRepairBanner({ hookStatus, busy, onRepair }) {
  const [dismissedNow, setDismissedNow] = useState(null);
  if (!hookStatus || hookStatus.status !== 'needs-repair') return null;

  const signature = signatureOf(hookStatus);
  if (dismissedNow === signature || readDismissed() === signature) return null;

  const dismiss = () => {
    writeDismissed(signature);
    setDismissedNow(signature);
  };

  return (
    <div className="claude-hook-banner" role="status">
      <span className="claude-hook-banner-icon" aria-hidden="true">⚠</span>
      <p className="claude-hook-banner-text">
        <strong>Claude Code hooks need repair.</strong>{' '}
        {hookStatus.reason}{' '}
        Until repaired, Claude Code may show a hook error on every turn.
      </p>
      <button type="button" className="claude-hook-button claude-hook-button--needs-repair" onClick={onRepair} disabled={busy}>
        {busy ? 'Repairing…' : 'Repair'}
      </button>
      <button type="button" className="claude-hook-banner-dismiss" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export default ClaudeHookRepairBanner;
