const path = require('path');
const os = require('os');

jest.mock('fs', () => ({ promises: { readdir: jest.fn(), readFile: jest.fn(), unlink: jest.fn() } }));
jest.mock('child_process', () => ({ execFile: jest.fn() }));
jest.mock('../claudeHookInstaller', () => ({ getStatus: jest.fn() }));

const fs = require('fs').promises;
const { execFile } = require('child_process');
const installer = require('../claudeHookInstaller');
const paths = require('../claudeHook/paths');
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
    it.each([
      ['installed', true],
      ['needs-repair', false],
      ['not-installed', false],
      ['unsupported', false],
    ])('status %s → %s', async (status, expected) => {
      installer.getStatus.mockResolvedValue({ status });
      expect(await scanner.checkHookConfigured()).toBe(expected);
    });

    it('returns false when the installer throws', async () => {
      installer.getStatus.mockRejectedValue(new Error('EACCES'));
      expect(await scanner.checkHookConfigured()).toBe(false);
    });
  });

  describe('state files', () => {
    it('reads state from ~/.claude/vscode-launchpad/state/<id>.json, not the temp dir', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ type: 'working' }));
      await scanner.readSessionState('abc-123');
      expect(fs.readFile).toHaveBeenCalledWith(paths.stateFilePath('abc-123'), 'utf-8');
      expect(paths.stateFilePath('abc-123')).toBe(
        path.join(os.homedir(), '.claude', 'vscode-launchpad', 'state', 'abc-123.json'));
    });

    it('cleanup deletes state files of sessions that are gone, keeps active ones', async () => {
      fs.readdir.mockResolvedValue(['live.json', 'dead.json', 'dead.json.tmp.42', 'README']);
      fs.unlink.mockResolvedValue(undefined);
      await scanner.cleanupStateFiles(new Set(['live']));
      expect(fs.readdir).toHaveBeenCalledWith(paths.stateDir());
      expect(fs.unlink).toHaveBeenCalledTimes(1);
      expect(fs.unlink).toHaveBeenCalledWith(path.join(paths.stateDir(), 'dead.json'));
    });

    it('cleanup tolerates a missing state dir', async () => {
      fs.readdir.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      await expect(scanner.cleanupStateFiles(new Set())).resolves.toBeUndefined();
      expect(fs.unlink).not.toHaveBeenCalled();
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
