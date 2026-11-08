import { matchSessionToWorkspace, buildSessionWorkspaceMap, getAggregateState, groupUnmatchedSessions, claudeFilterEmptyMessage } from '../useClaudeSessions';

describe('matchSessionToWorkspace', () => {
  it('matches exact paths', () => {
    expect(matchSessionToWorkspace('/Users/dev/project', '/Users/dev/project')).toBe(true);
  });

  it('matches subdirectory (worktree)', () => {
    expect(matchSessionToWorkspace('/Users/dev/project/.worktrees/feat-x', '/Users/dev/project')).toBe(true);
  });

  it('does not match unrelated paths', () => {
    expect(matchSessionToWorkspace('/Users/dev/other-project', '/Users/dev/project')).toBe(false);
  });

  it('matches when workspace is a .code-workspace file inside the CWD', () => {
    expect(matchSessionToWorkspace(
      '/Users/dev/project',
      '/Users/dev/project/project.code-workspace'
    )).toBe(true);
  });

  it('does not match partial directory name overlap', () => {
    // /Users/dev/project-v2 should NOT match /Users/dev/project
    expect(matchSessionToWorkspace('/Users/dev/project-v2', '/Users/dev/project')).toBe(false);
  });

  it('handles trailing slashes', () => {
    expect(matchSessionToWorkspace('/Users/dev/project/', '/Users/dev/project')).toBe(true);
    expect(matchSessionToWorkspace('/Users/dev/project', '/Users/dev/project/')).toBe(true);
  });

  it('returns false for empty paths', () => {
    expect(matchSessionToWorkspace('', '/Users/dev/project')).toBe(false);
    expect(matchSessionToWorkspace('/Users/dev/project', '')).toBe(false);
    expect(matchSessionToWorkspace(null, '/Users/dev/project')).toBe(false);
  });
});

describe('buildSessionWorkspaceMap', () => {
  const mockWorkspaces = [
    { path: 'file:///Users/dev/project-a', type: 'local' },
    { path: 'file:///Users/dev/project-b', type: 'local' },
  ];

  it('maps sessions to matching workspaces', () => {
    const sessions = [
      { sessionId: 's1', cwd: '/Users/dev/project-a', state: 'working' },
      { sessionId: 's2', cwd: '/Users/dev/project-b', state: 'waiting' },
    ];

    const map = buildSessionWorkspaceMap(sessions, mockWorkspaces);
    expect(map.get('/Users/dev/project-a')).toHaveLength(1);
    expect(map.get('/Users/dev/project-b')).toHaveLength(1);
  });

  it('groups multiple sessions in same workspace', () => {
    const sessions = [
      { sessionId: 's1', cwd: '/Users/dev/project-a', state: 'working' },
      { sessionId: 's2', cwd: '/Users/dev/project-a', state: 'waiting' },
    ];

    const map = buildSessionWorkspaceMap(sessions, mockWorkspaces);
    expect(map.get('/Users/dev/project-a')).toHaveLength(2);
  });

  it('matches sessions to file:// workspace paths', () => {
    const sessions = [
      { sessionId: 's1', cwd: '/Users/dev/project-a', state: 'working' },
    ];

    const map = buildSessionWorkspaceMap(sessions, mockWorkspaces);
    // Key is the normalized path (file:// stripped)
    expect(map.get('/Users/dev/project-a')).toHaveLength(1);
  });

  it('ignores sessions with no matching workspace', () => {
    const sessions = [
      { sessionId: 's1', cwd: '/Users/dev/unknown-project', state: 'working' },
    ];

    const map = buildSessionWorkspaceMap(sessions, mockWorkspaces);
    expect(map.size).toBe(0);
  });

  it('handles empty inputs', () => {
    expect(buildSessionWorkspaceMap([], mockWorkspaces).size).toBe(0);
    expect(buildSessionWorkspaceMap([], []).size).toBe(0);
  });
});

describe('getAggregateState', () => {
  it('returns null for empty sessions', () => {
    expect(getAggregateState([])).toBeNull();
    expect(getAggregateState(null)).toBeNull();
  });

  it('returns working when all sessions are working', () => {
    expect(getAggregateState([{ state: 'working' }, { state: 'working' }])).toBe('working');
  });

  it('returns waiting when any session is waiting (highest urgency)', () => {
    expect(getAggregateState([{ state: 'working' }, { state: 'waiting' }])).toBe('waiting');
  });

  it('returns waiting when all sessions are waiting', () => {
    expect(getAggregateState([{ state: 'waiting' }])).toBe('waiting');
  });

  it('returns idle when all sessions are idle', () => {
    expect(getAggregateState([{ state: 'idle' }, { state: 'idle' }])).toBe('idle');
  });
});

describe('groupUnmatchedSessions', () => {
  const s = (sessionId, cwd, state) => ({ sessionId, cwd, state, pid: 1 });
  const ws = (path) => ({ id: path, type: 'local', path: `file://${path}` });

  it('returns [] when there are no sessions', () => {
    expect(groupUnmatchedSessions([], new Map())).toEqual([]);
  });

  it('excludes sessions that matched a workspace', () => {
    const sessions = [s('a', '/Users/dev/frank', 'idle'), s('b', '/Users/dev/tools', 'working')];
    const map = buildSessionWorkspaceMap(sessions, [ws('/Users/dev/frank')]);
    const groups = groupUnmatchedSessions(sessions, map);
    expect(groups.map(g => g.cwd)).toEqual(['/Users/dev/tools']);
  });

  it('excludes zombies', () => {
    const groups = groupUnmatchedSessions([s('z', '/Users/dev/tools', 'zombie')], new Map());
    expect(groups).toEqual([]);
  });

  it('groups sessions by folder with per-state counts and the most urgent state', () => {
    const sessions = [
      s('a', '/Users/dev/super-fr', 'idle'),
      s('b', '/Users/dev/super-fr/', 'working'), // trailing slash: same folder
      s('c', '/Users/dev/super-fr', 'idle'),
    ];
    const [group] = groupUnmatchedSessions(sessions, new Map());
    expect(group).toMatchObject({
      cwd: '/Users/dev/super-fr',
      name: 'super-fr',
      state: 'working',
      counts: { working: 1, waiting: 0, idle: 2 },
    });
    expect(group.sessions.map(x => x.sessionId)).toEqual(['a', 'b', 'c']);
  });

  it('orders by urgency (waiting > working > idle), then by folder name', () => {
    const sessions = [
      s('1', '/x/zeta', 'idle'),
      s('2', '/x/alpha', 'idle'),
      s('3', '/x/mid', 'working'),
      s('4', '/x/late', 'waiting'),
    ];
    expect(groupUnmatchedSessions(sessions, new Map()).map(g => g.name)).toEqual(['late', 'mid', 'alpha', 'zeta']);
  });
});

describe('claudeFilterEmptyMessage', () => {
  const g = (counts) => ({ cwd: '/x', name: 'x', state: 'idle', counts: { working: 0, waiting: 0, idle: 0, ...counts }, sessions: [] });

  it('explains when the filtered state exists only in unmatched folders', () => {
    expect(claudeFilterEmptyMessage('working', [g({ working: 1 })]))
      .toBe("No workspace rows have working sessions. 1 is in a folder VS Code doesn't list; see Other sessions above.");
  });

  it('pluralises', () => {
    expect(claudeFilterEmptyMessage('waiting', [g({ waiting: 2 }), g({ waiting: 1 })]))
      .toBe("No workspace rows have waiting sessions. 3 are in folders VS Code doesn't list; see Other sessions above.");
  });

  it('returns null without a filter or without unmatched sessions in that state', () => {
    expect(claudeFilterEmptyMessage(null, [g({ working: 1 })])).toBeNull();
    expect(claudeFilterEmptyMessage('working', [g({ idle: 3 })])).toBeNull();
    expect(claudeFilterEmptyMessage('working', [])).toBeNull();
  });
});
