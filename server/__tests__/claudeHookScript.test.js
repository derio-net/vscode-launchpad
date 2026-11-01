/**
 * Runs the embedded hook script under a real /bin/sh with a throwaway HOME.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { HOOK_SCRIPT, HOOK_SCRIPT_HASH } = require('../claudeHook/hookScript');
const { stateDir, launchpadDir } = require('../claudeHook/paths');

describe('embedded Claude hook script', () => {
  let home, script;

  const run = (payload, ...args) => spawnSync('/bin/sh', [script, ...args], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    // Minimal env: proves the script needs nothing beyond HOME and a stock PATH
    env: { HOME: home, PATH: '/usr/bin:/bin' },
    encoding: 'utf-8',
  });
  const readState = (id) => JSON.parse(fs.readFileSync(path.join(stateDir(home), `${id}.json`), 'utf-8'));

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-script-'));
    script = path.join(home, 'hook.sh');
    fs.writeFileSync(script, HOOK_SCRIPT, { mode: 0o755 });
  });
  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  it('writes working state from the argument', () => {
    const res = run({ session_id: 'abc-123', hook_event_name: 'UserPromptSubmit', cwd: '/x "quoted"' }, 'working');
    expect(res.status).toBe(0);
    const state = readState('abc-123');
    expect(state.type).toBe('working');
    expect(typeof state.ts).toBe('number');
    expect(state.sessionId).toBe('abc-123');
  });

  it('writes idle state from the argument', () => {
    run({ session_id: 'abc-123' }, 'idle');
    expect(readState('abc-123').type).toBe('idle');
  });

  it('maps permission_prompt to waiting and idle_prompt to idle', () => {
    run({ session_id: 's1', notification_type: 'permission_prompt', message: 'needs "approval"' });
    expect(readState('s1').type).toBe('waiting');
    run({ session_id: 's2', notification_type: 'idle_prompt' });
    expect(readState('s2').type).toBe('idle');
  });

  it('handles pretty-printed JSON spanning lines', () => {
    run(JSON.stringify({ session_id: 'multi-line', notification_type: 'permission_prompt' }, null, 2));
    expect(readState('multi-line').type).toBe('waiting');
  });

  it('writes nothing and exits 0 without a session_id', () => {
    const res = run({ hook_event_name: 'Stop' }, 'idle');
    expect(res.status).toBe(0);
    expect(fs.existsSync(stateDir(home))).toBe(false);
  });

  it('refuses unsafe session ids (no path traversal)', () => {
    const res = run({ session_id: '../../evil' }, 'idle');
    expect(res.status).toBe(0);
    expect(fs.existsSync(stateDir(home))).toBe(false);
    expect(fs.existsSync(path.join(home, 'evil.json'))).toBe(false);
  });

  it('exits 0 silently when the state dir cannot be created', () => {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(launchpadDir(home), 'not a directory');
    const res = run({ session_id: 'abc' }, 'idle');
    expect(res.status).toBe(0);
    expect(res.stderr).toBe('');
  });

  it('exits 0 on empty or garbage input', () => {
    expect(run('').status).toBe(0);
    expect(run('not json at all').status).toBe(0);
  });

  it('exposes a stable sha256 hash of the script', () => {
    expect(HOOK_SCRIPT_HASH).toMatch(/^[0-9a-f]{64}$/);
    expect(HOOK_SCRIPT.startsWith('#!/bin/sh\n')).toBe(true);
  });
});
