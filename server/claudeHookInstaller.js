/**
 * Installs, repairs, refreshes and removes LaunchPad's Claude Code hook.
 *
 * Single implementation behind the UI (via the REST API), the CLI entry point
 * at the bottom, and scripts/install-claude-hooks.sh.
 *
 * Every function takes optional `{ home, platform, exists }` so tests can point
 * it at a throwaway HOME and fake the environment.
 */
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { HOOK_SCRIPT, HOOK_SCRIPT_HASH } = require('./claudeHook/hookScript');
const {
  launchpadDir,
  hookScriptPath,
  settingsPath,
  CURRENT_MARKER,
  LEGACY_MARKER,
} = require('./claudeHook/paths');

/** The three hook events, their matcher, and the argument passed to the script. */
const EVENTS = {
  Notification: { matcher: 'permission_prompt|idle_prompt', arg: null },
  UserPromptSubmit: { matcher: '', arg: 'working' },
  Stop: { matcher: '', arg: 'idle' },
};
const EVENT_NAMES = Object.keys(EVENTS);

class HookInstallerError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const resolveOpts = (opts = {}) => ({
  home: opts.home || os.homedir(),
  platform: opts.platform || process.platform,
  exists: opts.exists || fs.existsSync,
  // For tests, or a container whose ~/.claude really is the user's (bind-mounted)
  allowContainer: opts.allowContainer !== undefined
    ? opts.allowContainer
    : process.env.LAUNCHPAD_CLAUDE_HOOKS_ALLOW_CONTAINER === '1',
});

const unsupportedReason = ({ platform, exists, allowContainer }) => {
  if (platform === 'win32') return 'Claude Code status is not supported on Windows yet.';
  if (!allowContainer && (exists('/.dockerenv') || exists('/run/.containerenv'))) {
    return 'Running inside a container: its ~/.claude is not the one your Claude Code sessions use.';
  }
  return null;
};

const isOurs = (command) =>
  typeof command === 'string' && (command.includes(CURRENT_MARKER) || command.includes(LEGACY_MARKER));

/** The exact command LaunchPad writes for an event. Quoted absolute path (design D5). */
const canonicalCommand = (home, event) => {
  const { arg } = EVENTS[event];
  return `"${hookScriptPath(home)}"${arg ? ` ${arg}` : ''}`;
};

/** { exists: false } | { exists: true, settings, raw }; throws INVALID_SETTINGS on bad JSON. */
const readSettings = async (home) => {
  let raw;
  try {
    raw = await fsp.readFile(settingsPath(home), 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return { exists: false, settings: {} };
    throw err;
  }
  try {
    const settings = JSON.parse(raw);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('not an object');
    return { exists: true, settings, raw };
  } catch {
    throw new HookInstallerError(`${settingsPath(home)} is not valid JSON; refusing to modify it.`, 'INVALID_SETTINGS');
  }
};

const commandsFor = (settings, event) => {
  const entries = settings.hooks && settings.hooks[event];
  if (!Array.isArray(entries)) return [];
  return entries.flatMap(e => (e && Array.isArray(e.hooks) ? e.hooks : [])).map(h => h && h.command);
};

/** Settings with every LaunchPad hook removed; entries left with no hooks, empty arrays and an empty `hooks` are pruned. */
const stripOurHooks = (settings) => {
  const next = JSON.parse(JSON.stringify(settings));
  if (!next.hooks || typeof next.hooks !== 'object') return next;
  for (const event of EVENT_NAMES) {
    const entries = next.hooks[event];
    if (!Array.isArray(entries)) continue;
    const kept = entries
      .map(e => (e && Array.isArray(e.hooks) ? { ...e, hooks: e.hooks.filter(h => !isOurs(h && h.command)) } : e))
      .filter(e => !(e && Array.isArray(e.hooks) && e.hooks.length === 0));
    if (kept.length === 0) delete next.hooks[event];
    else next.hooks[event] = kept;
  }
  if (Object.keys(next.hooks).length === 0) delete next.hooks;
  return next;
};

const withOurHooks = (settings, home) => {
  const next = stripOurHooks(settings);
  next.hooks = next.hooks || {};
  for (const event of EVENT_NAMES) {
    const entry = { matcher: EVENTS[event].matcher, hooks: [{ type: 'command', command: canonicalCommand(home, event) }] };
    next.hooks[event] = [...(Array.isArray(next.hooks[event]) ? next.hooks[event] : []), entry];
  }
  return next;
};

/**
 * Create `target` fresh with `mode`: unlink any existing file first, then open
 * exclusively ('wx') so a planted symlink is never followed.
 */
const writeExclusive = async (target, data, mode) => {
  await fsp.rm(target, { force: true });
  await fsp.writeFile(target, data, { mode, flag: 'wx' });
  await fsp.chmod(target, mode); // writeFile's mode is filtered by the umask
};

/**
 * Back up the current file, then write atomically (temp file in the same dir +
 * rename). settings.json can hold secrets (e.g. `env` API keys), so the temp
 * file and the backup keep the original's permissions (0600 for a new file).
 */
const writeSettings = async (home, settings, previousRaw) => {
  const file = settingsPath(home);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  let mode = 0o600;
  try {
    mode = (await fsp.stat(file)).mode & 0o777;
  } catch { /* new file */ }
  if (previousRaw !== undefined) await writeExclusive(`${file}.launchpad.bak`, previousRaw, mode);
  const tmp = `${file}.launchpad.tmp.${process.pid}`;
  await writeExclusive(tmp, `${JSON.stringify(settings, null, 2)}\n`, mode);
  await fsp.rename(tmp, file);
};

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

/** Write hook.sh if missing or different from the bundled version. Returns true when written. */
const ensureScript = async (home) => {
  const file = hookScriptPath(home);
  try {
    if (sha256(await fsp.readFile(file, 'utf-8')) === HOOK_SCRIPT_HASH) return false;
  } catch { /* missing: write it */ }
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}`;
  await fsp.writeFile(tmp, HOOK_SCRIPT, { mode: 0o755 });
  await fsp.chmod(tmp, 0o755);
  await fsp.rename(tmp, file);
  return true;
};

const emptyEvents = () => Object.fromEntries(EVENT_NAMES.map(e => [e, false]));

/**
 * { status: 'installed'|'needs-repair'|'not-installed'|'unsupported', scriptPath, legacy, events, reason? }
 */
const getStatus = async (rawOpts) => {
  const opts = resolveOpts(rawOpts);
  const scriptPath = hookScriptPath(opts.home);
  const base = { scriptPath, legacy: false, events: emptyEvents() };

  const unsupported = unsupportedReason(opts);
  if (unsupported) return { ...base, status: 'unsupported', reason: unsupported };

  let read;
  try {
    read = await readSettings(opts.home);
  } catch (err) {
    return { ...base, status: 'not-installed', reason: err.message };
  }
  const { settings } = read;

  const all = EVENT_NAMES.flatMap(e => commandsFor(settings, e)).filter(isOurs);
  if (all.length === 0) return { ...base, status: 'not-installed' };

  const legacy = all.some(c => c.includes(LEGACY_MARKER));
  const events = Object.fromEntries(
    EVENT_NAMES.map(e => [e, commandsFor(settings, e).includes(canonicalCommand(opts.home, e))]),
  );
  const nonCanonical = EVENT_NAMES.some(e =>
    commandsFor(settings, e).some(c => isOurs(c) && c !== canonicalCommand(opts.home, e)));
  const scriptExists = opts.exists(scriptPath);
  const allEvents = EVENT_NAMES.every(e => events[e]);

  if (allEvents && scriptExists && !legacy && !nonCanonical) {
    return { ...base, status: 'installed', events };
  }
  let reason;
  if (legacy) reason = 'Hooks point at a script from a repository checkout (old install method).';
  else if (nonCanonical) reason = 'Hooks point at a hook script in another location.';
  else if (!scriptExists) reason = `The hook script is missing: ${scriptPath}`;
  else reason = `Hooks are missing for: ${EVENT_NAMES.filter(e => !events[e]).join(', ')}`;
  return { ...base, status: 'needs-repair', legacy, events, reason };
};

const assertSupported = (opts) => {
  const reason = unsupportedReason(opts);
  if (reason) throw new HookInstallerError(reason, 'UNSUPPORTED');
};

/** Install or repair. Idempotent: an `installed` setup is left byte-identical. */
const install = async (rawOpts) => {
  const opts = resolveOpts(rawOpts);
  assertSupported(opts);
  const read = await readSettings(opts.home); // throws before anything is written

  const current = await getStatus(opts);
  if (current.status === 'installed') {
    await ensureScript(opts.home);
    return current;
  }
  await ensureScript(opts.home);
  await writeSettings(opts.home, withOurHooks(read.settings, opts.home), read.exists ? read.raw : undefined);
  return getStatus(opts);
};

/** Remove every LaunchPad entry (current and legacy) and ~/.claude/vscode-launchpad/. */
const remove = async (rawOpts) => {
  const opts = resolveOpts(rawOpts);
  assertSupported(opts);
  const read = await readSettings(opts.home);
  if (read.exists) {
    const next = stripOurHooks(read.settings);
    if (JSON.stringify(next) !== JSON.stringify(read.settings)) {
      await writeSettings(opts.home, next, read.raw);
    }
  }
  await fsp.rm(launchpadDir(opts.home), { recursive: true, force: true });
  return getStatus(opts);
};

/** On startup: keep an enabled hook script current. Never touches settings.json. */
const refreshScript = async (rawOpts) => {
  const opts = resolveOpts(rawOpts);
  const { status } = await getStatus(opts);
  if (status === 'not-installed' || status === 'unsupported') return false;
  return ensureScript(opts.home);
};

module.exports = {
  getStatus,
  install,
  remove,
  refreshScript,
  HookInstallerError,
  EVENTS,
};

// ─── CLI: node server/claudeHookInstaller.js status|install|remove ───

/* istanbul ignore next */
if (require.main === module) {
  const describe = (s) => {
    const lines = [`Claude Code status hooks: ${s.status}`];
    if (s.reason) lines.push(`  ${s.reason}`);
    lines.push(`  Hook script: ${s.scriptPath}`);
    return lines.join('\n');
  };
  const command = process.argv[2] || 'status';
  const actions = { status: getStatus, install, remove };
  if (!actions[command]) {
    console.error(`Usage: ${path.basename(process.argv[1])} status|install|remove`);
    process.exit(2);
  }
  actions[command]()
    .then((s) => {
      console.log(describe(s));
      if (command === 'install' && s.status === 'installed') {
        console.log('  Restart running Claude Code sessions to pick up the hooks.');
      }
      const ok = command === 'remove' ? s.status === 'not-installed' : s.status === 'installed';
      process.exit(ok ? 0 : 1);
    })
    .catch((err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });
}
