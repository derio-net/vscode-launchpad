import { useState, useEffect, useCallback, useRef } from 'react';
import { getClaudeHooks, installClaudeHooks, removeClaudeHooks } from '../api/client';

/**
 * Claude Code hook installation status plus install/remove actions.
 *
 * Status is fetched on mount and whenever the window regains focus (the user
 * may have run the CLI installer or edited settings.json meanwhile). After a
 * successful action `onChange` runs, e.g. to refetch sessions so the Claude
 * column appears without waiting for the next poll.
 */
export function useClaudeHookStatus({ onChange } = {}) {
  const [hookStatus, setHookStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const refresh = useCallback(async () => {
    try {
      setHookStatus(await getClaudeHooks());
    } catch {
      // Keep the last known status; the sessions poll surfaces backend outages
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  const run = useCallback(async (action) => {
    setBusy(true);
    setError(null);
    try {
      setHookStatus(await action());
      if (onChangeRef.current) await onChangeRef.current();
      return true;
    } catch (err) {
      setError((err && err.message) || String(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const install = useCallback(() => run(installClaudeHooks), [run]);
  const remove = useCallback(() => run(removeClaudeHooks), [run]);

  return { hookStatus, busy, error, install, remove, refresh };
}

export default useClaudeHookStatus;
