const os = require('os');
const path = require('path');

/**
 * Locations owned by LaunchPad's Claude Code hook. Everything is derived from
 * the user's home directory, never from the temp dir: TMPDIR differs between
 * launchd, terminals, tmux and containers, so the hook and the scanner would
 * otherwise disagree (macOS: /tmp vs /var/folders/…/T).
 */
const launchpadDir = (home = os.homedir()) => path.join(home, '.claude', 'vscode-launchpad');
const hookScriptPath = (home = os.homedir()) => path.join(launchpadDir(home), 'hook.sh');
const stateDir = (home = os.homedir()) => path.join(launchpadDir(home), 'state');
const stateFilePath = (sessionId, home = os.homedir()) => path.join(stateDir(home), `${sessionId}.json`);
const settingsPath = (home = os.homedir()) => path.join(home, '.claude', 'settings.json');

/** A hook command is LaunchPad's if it contains either marker. */
const CURRENT_MARKER = 'vscode-launchpad/hook.sh';
const LEGACY_MARKER = 'claude-session-hook.sh';

module.exports = {
  launchpadDir,
  hookScriptPath,
  stateDir,
  stateFilePath,
  settingsPath,
  CURRENT_MARKER,
  LEGACY_MARKER,
};
