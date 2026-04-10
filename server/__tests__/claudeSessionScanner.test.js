const path = require('path');
const os = require('os');

jest.mock('fs', () => ({ promises: { readdir: jest.fn(), readFile: jest.fn(), unlink: jest.fn() } }));
jest.mock('child_process', () => ({ execFile: jest.fn() }));

const fs = require('fs').promises;
const { execFile } = require('child_process');
const scanner = require('../claudeSessionScanner');

describe('claudeSessionScanner', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getSessionsPath', () => {
    it('returns ~/.claude/sessions', () => {
      expect(scanner.getSessionsPath()).toBe(path.join(os.homedir(), '.claude', 'sessions'));
    });
  });

  describe('isProcessAlive', () => {
    it('returns true for current PID', () => {
      expect(scanner.isProcessAlive(process.pid)).toBe(true);
    });
    it('returns false for non-existent PID', () => {
      expect(scanner.isProcessAlive(99999999)).toBe(false);
    });
  });

  describe('checkHookConfigured', () => {
    const allThreeHooks = {
      Notification: [{
        matcher: 'permission_prompt|idle_prompt',
        hooks: [{ type: 'command', command: '/path/to/claude-session-hook.sh' }]
      }],
      UserPromptSubmit: [{
        matcher: '',
        hooks: [{ type: 'command', command: '/path/to/claude-session-hook.sh working' }]
      }],
      Stop: [{
        matcher: '',
        hooks: [{ type: 'command', command: '/path/to/claude-session-hook.sh idle' }]
      }],
    };

    it('returns true when all three hooks are configured', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ hooks: allThreeHooks }));
      expect(await scanner.checkHookConfigured()).toBe(true);
    });

    it('returns false when only Notification hook configured', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({
        hooks: {
          Notification: allThreeHooks.Notification,
        }
      }));
      expect(await scanner.checkHookConfigured()).toBe(false);
    });

    it('returns false when no hooks configured', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ statusLine: {} }));
      expect(await scanner.checkHookConfigured()).toBe(false);
    });

    it('returns false when settings file missing', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));
      expect(await scanner.checkHookConfigured()).toBe(false);
    });

    it('returns false when hook script name not found', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({
        hooks: {
          Notification: [{
            hooks: [{ type: 'command', command: 'some-other-script.sh' }]
          }],
          UserPromptSubmit: [{
            hooks: [{ type: 'command', command: 'some-other-script.sh' }]
          }],
          Stop: [{
            hooks: [{ type: 'command', command: 'some-other-script.sh' }]
          }],
        }
      }));
      expect(await scanner.checkHookConfigured()).toBe(false);
    });
  });

  describe('readSessionState', () => {
    it('returns working for working state file', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ type: 'working', ts: 123 }));
      expect(await scanner.readSessionState('test-id')).toBe('working');
    });

    it('returns waiting for waiting state file', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ type: 'waiting', ts: 123 }));
      expect(await scanner.readSessionState('test-id')).toBe('waiting');
    });

    it('returns idle for idle state file', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ type: 'idle', ts: 123 }));
      expect(await scanner.readSessionState('test-id')).toBe('idle');
    });

    it('returns idle when state file missing', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));
      expect(await scanner.readSessionState('test-id')).toBe('idle');
    });

    it('returns idle for malformed state file', async () => {
      fs.readFile.mockResolvedValue('not json{{{');
      expect(await scanner.readSessionState('test-id')).toBe('idle');
    });

    it('returns idle for unknown state type', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ type: 'unknown_state' }));
      expect(await scanner.readSessionState('test-id')).toBe('idle');
    });
  });

  describe('scanSessions', () => {
    it('returns empty when hookConfigured is false', async () => {
      expect(await scanner.scanSessions(false)).toEqual([]);
    });

    it('returns empty when sessions directory missing', async () => {
      fs.readdir.mockRejectedValue(new Error('ENOENT'));
      expect(await scanner.scanSessions(true)).toEqual([]);
    });

    it('parses valid session with state file', async () => {
      // readdir for sessions dir
      fs.readdir
        .mockResolvedValueOnce(['12345.json'])  // sessions dir
        .mockResolvedValueOnce([]);  // tmp dir for cleanup

      // readFile: first call = session file, second = state file
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify({
          pid: process.pid, sessionId: 'test-id', cwd: '/test', entrypoint: 'cli',
        }))
        .mockResolvedValueOnce(JSON.stringify({ type: 'working' }));

      // Mock ps calls for zombie detection (ppid checks)
      execFile.mockImplementation((cmd, args, cb) => {
        cb(null, { stdout: '1' }); // ppid = 1 = zombie
      });

      const sessions = await scanner.scanSessions(true);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('test-id');
      // Will be zombie since ppid=1 mocked
      expect(sessions[0].state).toBe('zombie');
    });

    it('skips dead PIDs', async () => {
      fs.readdir
        .mockResolvedValueOnce(['99999999.json'])
        .mockResolvedValueOnce([]);
      fs.readFile.mockResolvedValue(JSON.stringify({
        pid: 99999999, sessionId: 'dead', cwd: '/path',
      }));
      expect(await scanner.scanSessions(true)).toEqual([]);
    });
  });

  describe('killSessions', () => {
    it('returns killed for valid claude processes', async () => {
      execFile.mockImplementation((cmd, args, cb) => {
        cb(null, { stdout: 'claude --some-args' });
      });
      // Mock process.kill
      const origKill = process.kill;
      process.kill = jest.fn();
      const result = await scanner.killSessions([12345]);
      expect(result.killed).toEqual([12345]);
      expect(result.failed).toEqual([]);
      process.kill = origKill;
    });

    it('refuses to kill non-claude processes', async () => {
      execFile.mockImplementation((cmd, args, cb) => {
        cb(null, { stdout: 'node server.js' });
      });
      const result = await scanner.killSessions([12345]);
      expect(result.killed).toEqual([]);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('not a claude process');
    });
  });
});
