/**
 * Exercises scripts/install-claude-hooks.sh against a throwaway HOME.
 *
 * The installer writes absolute hook paths into ~/.claude/settings.json, so a
 * checkout that moves leaves dead hooks behind. Re-running the installer from
 * the new location must repair them rather than report "already installed".
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_SCRIPTS = path.join(__dirname, '..', '..', 'scripts');
const HOOK = 'claude-session-hook.sh';
const hasJq = spawnSync('sh', ['-c', 'command -v jq']).status === 0;
const describeIfJq = hasJq ? describe : describe.skip;

describeIfJq('install-claude-hooks.sh', () => {
  let tmp, home, checkout, installer, hookScript, settingsFile;

  const run = (...args) => spawnSync('bash', [installer, ...args], {
    env: { ...process.env, HOME: home },
    encoding: 'utf-8',
  });
  const readSettings = () => JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
  const ourCommands = (settings, event) =>
    (settings.hooks[event] || []).flatMap(e => e.hooks.map(h => h.command)).filter(c => c.includes(HOOK));

  const staleEntry = (suffix) => ({
    matcher: '',
    hooks: [{ type: 'command', command: `/old/checkout/scripts/${HOOK}${suffix}` }],
  });

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'install-hooks-'));
    home = path.join(tmp, 'home');
    checkout = path.join(tmp, 'new-checkout', 'scripts');
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.mkdirSync(checkout, { recursive: true });
    for (const f of ['install-claude-hooks.sh', HOOK]) {
      fs.copyFileSync(path.join(REPO_SCRIPTS, f), path.join(checkout, f));
    }
    installer = path.join(checkout, 'install-claude-hooks.sh');
    hookScript = path.join(checkout, HOOK);
    settingsFile = path.join(home, '.claude', 'settings.json');
    fs.writeFileSync(settingsFile, JSON.stringify({
      hooks: {
        Notification: [{ matcher: 'permission_prompt|idle_prompt', hooks: [{ type: 'command', command: `/old/checkout/scripts/${HOOK}` }] }],
        UserPromptSubmit: [staleEntry(' working')],
        Stop: [
          { matcher: '', hooks: [{ type: 'command', command: 'echo unrelated-user-hook' }] },
          staleEntry(' idle'),
        ],
      },
    }));
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('--check reports stale hooks that point at a missing script', () => {
    const res = run('--check');
    expect(res.status).not.toBe(0);
    expect(res.stdout + res.stderr).toMatch(/\/old\/checkout/);
  });

  it('install replaces stale hook paths with this checkout and keeps unrelated hooks', () => {
    const res = run();
    expect(res.status).toBe(0);
    const s = readSettings();
    expect(ourCommands(s, 'Notification')).toEqual([hookScript]);
    expect(ourCommands(s, 'UserPromptSubmit')).toEqual([`${hookScript} working`]);
    expect(ourCommands(s, 'Stop')).toEqual([`${hookScript} idle`]);
    expect(JSON.stringify(s)).not.toMatch(/\/old\/checkout/);
    expect(s.hooks.Stop.some(e => e.hooks.some(h => h.command === 'echo unrelated-user-hook'))).toBe(true);
    expect(run('--check').status).toBe(0);
  });

  it('install is idempotent once hooks point at this checkout', () => {
    run();
    const before = fs.readFileSync(settingsFile, 'utf-8');
    const res = run();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/nothing to do/);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toBe(before);
  });
});
