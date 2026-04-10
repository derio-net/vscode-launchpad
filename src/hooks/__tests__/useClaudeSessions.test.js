import { matchSessionToWorkspace, buildSessionWorkspaceMap, getAggregateState } from '../useClaudeSessions';

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
