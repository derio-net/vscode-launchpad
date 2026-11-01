/**
 * scripts/install-claude-hooks.sh: thin wrapper over server/claudeHookInstaller.js.
 * Runs the real script against a throwaway HOME, starting from legacy hooks that
 * point at a checkout which has since moved (the bug that motivated this change).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { hookScriptPath, settingsPath } = require('../claudeHook/paths');

const WRAPPER = path.join(__dirname, '..', '..', 'scripts', 'install-claude-hooks.sh');

describe('install-claude-hooks.sh', () => {
  let home;

  const run = (...args) => spawnSync('bash', [WRAPPER, ...args], {
    // Allow the suite to run inside a devcontainer; no jq on PATH needed
    env: { ...process.env, HOME: home, LAUNCHPAD_CLAUDE_HOOKS_ALLOW_CONTAINER: '1' },
    encoding: 'utf-8',
  });
  const readSettings = () => JSON.parse(fs.readFileSync(settingsPath(home), 'utf-8'));
  const ours = (s, event) => (s.hooks[event] || []).flatMap(e => e.hooks.map(h => h.command))
    .filter(c => c.includes('hook.sh') || c.includes('claude-session-hook.sh'));

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'install-wrapper-'));
    fs.mkdirSync(path.join(home, '.claude'));
    const legacy = (suffix) => ({ matcher: '', hooks: [{ type: 'command', command: `/old/checkout/scripts/claude-session-hook.sh${suffix}` }] });
    fs.writeFileSync(settingsPath(home), JSON.stringify({
      hooks: {
        Notification: [{ ...legacy(''), matcher: 'permission_prompt|idle_prompt' }],
        UserPromptSubmit: [legacy(' working')],
        Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'echo unrelated-user-hook' }] }, legacy(' idle')],
      },
    }));
  });
  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  it('--check fails on legacy hooks and says why', () => {
    const res = run('--check');
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/needs-repair/);
    expect(res.stdout).toMatch(/repository checkout/);
  });

  it('install migrates legacy hooks to the bundled script and keeps unrelated hooks', () => {
    const res = run();
    expect(res.status).toBe(0);
    const s = readSettings();
    const script = hookScriptPath(home);
    expect(ours(s, 'Notification')).toEqual([`"${script}"`]);
    expect(ours(s, 'UserPromptSubmit')).toEqual([`"${script}" working`]);
    expect(ours(s, 'Stop')).toEqual([`"${script}" idle`]);
    expect(JSON.stringify(s)).not.toMatch(/old\/checkout/);
    expect(s.hooks.Stop[0].hooks[0].command).toBe('echo unrelated-user-hook');
    expect(fs.existsSync(script)).toBe(true);
    expect(run('--check').status).toBe(0);
  });

  it('install is idempotent', () => {
    run();
    const before = fs.readFileSync(settingsPath(home), 'utf-8');
    expect(run().status).toBe(0);
    expect(fs.readFileSync(settingsPath(home), 'utf-8')).toBe(before);
  });

  it('--remove removes only LaunchPad hooks', () => {
    run();
    const res = run('--remove');
    expect(res.status).toBe(0);
    const s = readSettings();
    expect(s.hooks).toEqual({ Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'echo unrelated-user-hook' }] }] });
  });

  it('rejects unknown flags', () => {
    expect(run('--bogus').status).toBe(2);
  });
});

describe('scripts/claude-session-hook.sh (legacy shim)', () => {
  const SHIM = path.join(__dirname, '..', '..', 'scripts', 'claude-session-hook.sh');
  let home;
  const run = (...args) => spawnSync('/bin/sh', [SHIM, ...args], {
    input: JSON.stringify({ session_id: 'legacy-1' }),
    env: { HOME: home, PATH: '/usr/bin:/bin' },
    encoding: 'utf-8',
  });

  beforeEach(() => { home = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-shim-')); });
  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  it('exits 0 silently when the bundled hook is not installed', () => {
    const res = run('idle');
    expect(res.status).toBe(0);
    expect(res.stderr).toBe('');
  });

  it('forwards to the bundled hook when installed', async () => {
    const installer = require('../claudeHookInstaller');
    await installer.install({ home, platform: 'darwin', exists: (p) => !['/.dockerenv', '/run/.containerenv'].includes(p) && fs.existsSync(p) });
    expect(run('working').status).toBe(0);
    const state = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'vscode-launchpad', 'state', 'legacy-1.json'), 'utf-8'));
    expect(state.type).toBe('working');
  });
});
