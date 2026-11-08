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

const STATE_RANK = { waiting: 0, working: 1, idle: 2 };

/**
 * Live sessions that landed on no workspace row (their folder isn't in VS Code's
 * workspace list), grouped by folder:
 *   [{ cwd, name, state, counts: { working, waiting, idle }, sessions }]
 * Ordered most urgent first (waiting > working > idle), then by folder name.
 * Zombies are excluded; they have their own section.
 */
export const groupUnmatchedSessions = (sessions, sessionMap) => {
  const matched = new Set();
  for (const list of sessionMap.values()) {
    for (const s of list) matched.add(s);
  }

  const groups = new Map();
  for (const session of sessions) {
    if (session.state === 'zombie' || matched.has(session)) continue;
    const cwd = normalizePath(session.cwd);
    if (!cwd) continue;
    if (!groups.has(cwd)) {
      groups.set(cwd, { cwd, name: cwd.split('/').filter(Boolean).pop() || cwd, sessions: [] });
    }
    groups.get(cwd).sessions.push(session);
  }

  return [...groups.values()]
    .map(g => ({
      ...g,
      state: getAggregateState(g.sessions),
      counts: {
        working: g.sessions.filter(s => s.state === 'working').length,
        waiting: g.sessions.filter(s => s.state === 'waiting').length,
        idle: g.sessions.filter(s => s.state === 'idle').length,
      },
    }))
    .sort((a, b) => (STATE_RANK[a.state] - STATE_RANK[b.state]) || a.name.localeCompare(b.name));
};

/**
 * Why a working/waiting filter shows no rows, when the answer is "those sessions
 * are in folders without a workspace row". Returns null when that isn't the cause.
 */
export const claudeFilterEmptyMessage = (claudeFilter, unmatched) => {
  if (claudeFilter !== 'working' && claudeFilter !== 'waiting') return null;
  const count = unmatched.reduce((n, g) => n + (g.counts[claudeFilter] || 0), 0);
  if (count === 0) return null;
  const where = count === 1 ? 'is in a folder' : 'are in folders';
  return `No workspace rows have ${claudeFilter} sessions. ${count} ${where} VS Code doesn't list; see Other sessions above.`;
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

  const unmatched = useMemo(
    () => groupUnmatchedSessions(sessions, sessionMap),
    [sessions, sessionMap]
  );

  return { sessions, sessionMap, summary, transitions, zombies, unmatched, hookConfigured, refresh: fetchSessions };
}

export default useClaudeSessions;
