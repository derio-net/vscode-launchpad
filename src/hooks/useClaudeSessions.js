import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getClaudeSessions } from '../api/client';
import { extractWorkspacePath } from '../utils/workspaceUtils';

const POLL_INTERVAL = 5000;

const normalizePath = (p) => {
  if (!p) return '';
  let normalized = p.replace(/\/+$/, '');
  if (/^[A-Z]:\\/.test(normalized)) normalized = normalized.toLowerCase();
  return normalized;
};

/**
 * Match a session CWD to a workspace path.
 */
export const matchSessionToWorkspace = (sessionCwd, workspacePath) => {
  const normalizedCwd = normalizePath(sessionCwd);
  const normalizedWs = normalizePath(workspacePath);
  if (!normalizedCwd || !normalizedWs) return false;
  if (normalizedCwd === normalizedWs) return true;
  if (normalizedCwd.startsWith(normalizedWs + '/')) return true;
  if (normalizedWs.startsWith(normalizedCwd + '/')) return true;
  return false;
};

/**
 * Build a map of workspace path -> sessions[] (excludes zombies)
 */
export const buildSessionWorkspaceMap = (sessions, workspaces) => {
  const map = new Map();
  // Only map non-zombie sessions to workspaces
  const liveSessions = sessions.filter(s => s.state !== 'zombie');

  for (const session of liveSessions) {
    for (const workspace of workspaces) {
      const wsPath = extractWorkspacePath(workspace);
      if (matchSessionToWorkspace(session.cwd, wsPath)) {
        const existing = map.get(wsPath) || [];
        existing.push(session);
        map.set(wsPath, existing);
        break;
      }
    }
  }
  return map;
};

/**
 * Get aggregate state for a set of sessions (urgency order: waiting > working > idle)
 */
export const getAggregateState = (sessions) => {
  if (!sessions || sessions.length === 0) return null;
  if (sessions.some(s => s.state === 'waiting')) return 'waiting';
  if (sessions.some(s => s.state === 'working')) return 'working';
  return 'idle';
};

/**
 * Hook that polls for Claude Code sessions and maps them to workspaces.
 */
export function useClaudeSessions(workspaces) {
  const [sessions, setSessions] = useState([]);
  const [hookConfigured, setHookConfigured] = useState(false);
  const previousStatesRef = useRef(new Map());

  const fetchSessions = useCallback(async () => {
    try {
      const data = await getClaudeSessions();
      setHookConfigured(data.hookConfigured || false);
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
      setHookConfigured(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const sessionMap = useMemo(
    () => buildSessionWorkspaceMap(sessions, workspaces || []),
    [sessions, workspaces]
  );

  const zombies = useMemo(
    () => sessions.filter(s => s.state === 'zombie'),
    [sessions]
  );

  // Detect working -> waiting transitions for notifications
  const transitions = useMemo(() => {
    const newTransitions = [];
    const prevStates = previousStatesRef.current;
    const currentStates = new Map();

    for (const session of sessions) {
      currentStates.set(session.sessionId, session.state);
      const prev = prevStates.get(session.sessionId);
      if (prev === 'working' && session.state === 'waiting') {
        newTransitions.push(session);
      }
    }
    previousStatesRef.current = currentStates;
    return newTransitions;
  }, [sessions]);

  const summary = useMemo(() => {
    const live = sessions.filter(s => s.state !== 'zombie');
    return {
      total: live.length,
      working: live.filter(s => s.state === 'working').length,
      waiting: live.filter(s => s.state === 'waiting').length,
      idle: live.filter(s => s.state === 'idle').length,
      zombies: zombies.length,
    };
  }, [sessions, zombies]);

  return { sessions, sessionMap, summary, transitions, zombies, hookConfigured };
}

export default useClaudeSessions;
