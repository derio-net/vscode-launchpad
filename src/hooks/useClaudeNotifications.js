import { useEffect, useRef, useCallback } from 'react';

const DEBOUNCE_MS = 30000; // 30 seconds per session

/**
 * Request notification permission on first call.
 * Returns true if permission is granted.
 */
const ensurePermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

/**
 * Hook that sends desktop notifications when Claude sessions need tool approval.
 *
 * @param {Array} transitions - Sessions that just transitioned working -> waiting
 * @param {Map} sessionMap - Map of workspace path -> sessions
 * @param {Array} workspaces - Workspace list for name lookup
 */
export function useClaudeNotifications(transitions, sessionMap, workspaces) {
  const lastNotifiedRef = useRef(new Map()); // sessionId -> timestamp

  const findWorkspaceName = useCallback((cwd) => {
    if (!workspaces) return cwd;
    for (const ws of workspaces) {
      const wsPath = ws.workspacePath || ws.path || '';
      const normalizedCwd = cwd.replace(/\/+$/, '');
      const normalizedWs = wsPath.replace(/\/+$/, '');
      if (normalizedCwd === normalizedWs || normalizedCwd.startsWith(normalizedWs + '/')) {
        return ws.name;
      }
    }
    // Fallback: last directory component
    return cwd.split('/').filter(Boolean).pop() || cwd;
  }, [workspaces]);

  useEffect(() => {
    if (!transitions || transitions.length === 0) return;

    const notify = async () => {
      const hasPermission = await ensurePermission();
      if (!hasPermission) return;

      const now = Date.now();
      const lastNotified = lastNotifiedRef.current;

      for (const session of transitions) {
        const lastTime = lastNotified.get(session.sessionId) || 0;
        if (now - lastTime < DEBOUNCE_MS) continue;

        lastNotified.set(session.sessionId, now);

        const workspaceName = findWorkspaceName(session.cwd);
        const notification = new Notification('Claude needs approval', {
          body: `Claude is waiting for tool approval in ${workspaceName}`,
          tag: `claude-waiting-${session.sessionId}`,
          requireInteraction: false,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }

      // Clean up old entries
      for (const [sid, time] of lastNotified.entries()) {
        if (now - time > DEBOUNCE_MS * 10) {
          lastNotified.delete(sid);
        }
      }
    };

    notify();
  }, [transitions, findWorkspaceName]);
}

export default useClaudeNotifications;
