const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

let sessionsCache = { hookConfigured: false, sessions: [] };

const SCAN_INTERVAL = parseInt(process.env.CLAUDE_SCAN_INTERVAL, 10) || 5000;
const STATE_DIR = os.tmpdir();
const HOOK_SCRIPT_NAME = 'claude-session-hook.sh';

// ─── Helpers ───

const getSessionsPath = () => path.join(os.homedir(), '.claude', 'sessions');
const getSettingsPath = () => path.join(os.homedir(), '.claude', 'settings.json');
const stateFilePath = (sessionId) => path.join(STATE_DIR, `claude-session-state-${sessionId}.json`);

const isProcessAlive = (pid) => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};

// ─── Hook Configuration Check ───

/**
 * Check if ~/.claude/settings.json has our hook script configured.
 * Returns true if the script appears in any hook configuration.
 */
const checkHookConfigured = async () => {
  try {
    const content = await fs.readFile(getSettingsPath(), 'utf-8');
    const settings = JSON.parse(content);
    const hooks = settings.hooks || {};

    // Check if our hook script name appears in any hook command
    const hasHook = (eventName) => {
      const eventHooks = hooks[eventName];
      if (!Array.isArray(eventHooks)) return false;
      return eventHooks.some(entry => {
        const innerHooks = entry.hooks || [];
        return innerHooks.some(h => h.command && h.command.includes(HOOK_SCRIPT_NAME));
      });
    };

    // Require all three hooks for accurate state coverage
    return hasHook('Notification') && hasHook('UserPromptSubmit') && hasHook('Stop');
  } catch {
    return false;
  }
};

// ─── Hook State File Reading ───

/**
 * Read session state from /tmp/claude-session-state-<sessionId>.json
 * Returns the state type string or 'idle' as default.
 */
const readSessionState = async (sessionId) => {
  try {
    const content = await fs.readFile(stateFilePath(sessionId), 'utf-8');
    const data = JSON.parse(content);
    const validStates = ['working', 'waiting', 'idle'];
    return validStates.includes(data.type) ? data.type : 'idle';
  } catch {
    // No state file or unreadable — default to idle
    return 'idle';
  }
};

// ─── Zombie Detection ───

/**
 * Get the parent PID of a process.
 */
const getParentPid = async (pid) => {
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'ppid=', '-p', String(pid)]);
    return parseInt(stdout.trim()) || null;
  } catch {
    return null;
  }
};

/**
 * Get the command of a process.
 */
const getProcessCommand = async (pid) => {
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'command=', '-p', String(pid)]);
    return stdout.trim();
  } catch {
    return '';
  }
};

/**
 * Check if a tmux socket has attached clients.
 * Returns true if clients are attached (not zombie).
 */
const tmuxHasClients = async (tmuxCommand, socketPath) => {
  try {
    // Extract tmux binary path from command
    const binMatch = tmuxCommand.match(/^-?(\S*tmux\S*)/);
    const tmuxBin = binMatch ? binMatch[1] : 'tmux';
    const { stdout } = await execFileAsync(tmuxBin, ['-S', socketPath, 'list-clients']);
    return stdout.trim().length > 0;
  } catch {
    // list-clients failed — tmux server may be gone
    return false;
  }
};

/**
 * Detect if a session is a zombie.
 *
 * CLI/tmux (zsh4humans): tmux socket has 0 attached clients
 * CLI/regular terminal: grandparent is PID 1 (launchd)
 * VS Code extension: parent is PID 1 (Code Helper died)
 */
const isZombie = async (pid, entrypoint) => {
  try {
    if (process.platform !== 'darwin' && process.platform !== 'linux') return false;

    if (entrypoint === 'claude-vscode') {
      // VS Code extension: parent is Code Helper (Plugin)
      const ppid = await getParentPid(pid);
      if (!ppid) return false;
      // If parent is PID 1, VS Code closed
      return ppid === 1;
    }

    // CLI session: walk up claude → zsh → tmux/terminal
    const shellPid = await getParentPid(pid);
    if (!shellPid) return false;

    const grandparentPid = await getParentPid(shellPid);
    if (!grandparentPid) return false;

    const gpCommand = await getProcessCommand(grandparentPid);

    // Check for tmux (zsh4humans pattern)
    const tmuxSocketMatch = gpCommand.match(/-S\s+(\/tmp\/z4h-tmux-[^\s]+)/);
    if (tmuxSocketMatch) {
      return !(await tmuxHasClients(gpCommand, tmuxSocketMatch[1]));
    }

    // Check for generic tmux
    if (gpCommand.includes('tmux')) {
      const genericSocketMatch = gpCommand.match(/-S\s+(\S+)/);
      if (genericSocketMatch) {
        return !(await tmuxHasClients(gpCommand, genericSocketMatch[1]));
      }
    }

    // Regular terminal: if grandparent is PID 1 (launchd), terminal is gone
    return grandparentPid === 1;
  } catch {
    return false;
  }
};

// ─── Scanner ───

const scanSessions = async (hookConfigured) => {
  if (!hookConfigured) return [];

  const sessionsDir = getSessionsPath();
  let files;
  try { files = await fs.readdir(sessionsDir); } catch { return []; }

  const jsonFiles = files.filter(f => f.endsWith('.json'));
  const sessions = [];
  const activeSessionIds = new Set();

  for (const file of jsonFiles) {
    try {
      const filePath = path.join(sessionsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (!data.pid || !data.sessionId || !data.cwd) continue;
      if (!isProcessAlive(data.pid)) continue;

      activeSessionIds.add(data.sessionId);

      const [hookState, zombie] = await Promise.all([
        readSessionState(data.sessionId),
        isZombie(data.pid, data.entrypoint || 'cli'),
      ]);

      // Zombie overrides hook state
      const state = zombie ? 'zombie' : hookState;

      sessions.push({
        pid: data.pid,
        sessionId: data.sessionId,
        cwd: data.cwd,
        startedAt: data.startedAt || null,
        entrypoint: data.entrypoint || 'unknown',
        state,
      });
    } catch { continue; }
  }

  // Clean up stale state files
  cleanupStateFiles(activeSessionIds);

  return sessions;
};

/**
 * Remove state files for sessions that no longer exist.
 */
const cleanupStateFiles = async (activeSessionIds) => {
  try {
    const tmpFiles = await fs.readdir(STATE_DIR);
    const stateFiles = tmpFiles.filter(f => f.startsWith('claude-session-state-') && f.endsWith('.json'));
    for (const file of stateFiles) {
      const sessionId = file.replace('claude-session-state-', '').replace('.json', '');
      if (!activeSessionIds.has(sessionId)) {
        try { await fs.unlink(path.join(STATE_DIR, file)); } catch { /* ignore */ }
      }
    }
  } catch { /* /tmp not readable — ignore */ }
};

// ─── Kill ───

/**
 * Kill a list of PIDs after validating they are claude processes.
 * Returns { killed: [...], failed: [...] }
 */
const killSessions = async (pids) => {
  const killed = [];
  const failed = [];

  for (const pid of pids) {
    try {
      const cmd = await getProcessCommand(pid);
      if (!cmd.includes('claude')) {
        failed.push({ pid, reason: 'not a claude process' });
        continue;
      }
      process.kill(pid, 'SIGTERM');
      killed.push(pid);
    } catch (err) {
      failed.push({ pid, reason: err.message });
    }
  }

  return { killed, failed };
};

// ─── Cache & Init ───

const getSessions = () => sessionsCache;

const refreshSessions = async () => {
  try {
    const hookConfigured = await checkHookConfigured();
    const sessions = await scanSessions(hookConfigured);
    sessionsCache = { hookConfigured, sessions };
  } catch (error) {
    console.error('[Claude Scanner] Error:', error.message);
  }
};

const initialize = async () => {
  await refreshSessions();
  setInterval(refreshSessions, SCAN_INTERVAL);
  const status = sessionsCache.hookConfigured ? 'hooks detected' : 'hooks NOT configured — Claude integration disabled';
  console.log(`[Claude Scanner] Initialized (${status}), polling every ${SCAN_INTERVAL}ms`);
};

module.exports = {
  initialize,
  getSessions,
  refreshSessions,
  scanSessions,
  killSessions,
  getSessionsPath,
  getSettingsPath,
  isProcessAlive,
  checkHookConfigured,
  readSessionState,
  isZombie,
  stateFilePath,
  HOOK_SCRIPT_NAME,
};
