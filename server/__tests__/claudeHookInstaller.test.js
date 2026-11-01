/**
 * Installer tests against a throwaway HOME (real filesystem, no mocks).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const installer = require('../claudeHookInstaller');
const { HOOK_SCRIPT } = require('../claudeHook/hookScript');
const { hookScriptPath, settingsPath, launchpadDir } = require('../claudeHook/paths');

const CONTAINER_MARKERS = ['/.dockerenv', '/run/.containerenv'];

describe('claudeHookInstaller', () => {
  let home, opts;

  const writeSettings = (obj) => {
    fs.mkdirSync(path.dirname(settingsPath(home)), { recursive: true });
    fs.writeFileSync(settingsPath(home), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
  };
  const readSettings = () => JSON.parse(fs.readFileSync(settingsPath(home), 'utf-8'));
  const commands = (settings, event) =>
    ((settings.hooks || {})[event] || []).flatMap(e => (e.hooks || []).map(h => h.command));
  const entry = (command, matcher = '') => ({ matcher, hooks: [{ type: 'command', command }] });
  const legacy = (suffix = '') => `/old/checkout/scripts/claude-session-hook.sh${suffix}`;
  const userStop = entry('echo unrelated-user-hook');

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-installer-'));
    // Hide container markers: the suite itself may run inside a devcontainer/CI container
    opts = { home, platform: 'darwin', exists: (p) => !CONTAINER_MARKERS.includes(p) && fs.existsSync(p) };
  });
  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  describe('getStatus', () => {
    it('is not-installed when settings.json is missing', async () => {
      expect((await installer.getStatus(opts)).status).toBe('not-installed');
    });

    it('is not-installed when no LaunchPad hooks exist', async () => {
      writeSettings({ hooks: { Stop: [userStop] }, model: 'x' });
      const s = await installer.getStatus(opts);
      expect(s.status).toBe('not-installed');
      expect(s.scriptPath).toBe(hookScriptPath(home));
    });

    it('is installed after install()', async () => {
      await installer.install(opts);
      const s = await installer.getStatus(opts);
      expect(s).toMatchObject({
        status: 'installed',
        legacy: false,
        events: { Notification: true, UserPromptSubmit: true, Stop: true },
      });
    });

    it('is needs-repair with legacy entries from a checkout', async () => {
      writeSettings({ hooks: {
        Notification: [entry(legacy(), 'permission_prompt|idle_prompt')],
        UserPromptSubmit: [entry(legacy(' working'))],
        Stop: [entry(legacy(' idle'))],
      } });
      const s = await installer.getStatus(opts);
      expect(s.status).toBe('needs-repair');
      expect(s.legacy).toBe(true);
    });

    it('is needs-repair when the hook script is missing', async () => {
      await installer.install(opts);
      fs.unlinkSync(hookScriptPath(home));
      expect((await installer.getStatus(opts)).status).toBe('needs-repair');
    });

    it('is needs-repair when only some events are hooked', async () => {
      await installer.install(opts);
      const s = readSettings();
      delete s.hooks.Stop;
      writeSettings(s);
      const st = await installer.getStatus(opts);
      expect(st.status).toBe('needs-repair');
      expect(st.events.Stop).toBe(false);
    });

    it('is needs-repair when an entry points at another home', async () => {
      writeSettings({ hooks: {
        Notification: [entry('"/Users/someone-else/.claude/vscode-launchpad/hook.sh"', 'permission_prompt|idle_prompt')],
      } });
      expect((await installer.getStatus(opts)).status).toBe('needs-repair');
    });

    it('is unsupported on Windows', async () => {
      const s = await installer.getStatus({ ...opts, platform: 'win32' });
      expect(s.status).toBe('unsupported');
      expect(s.reason).toMatch(/Windows/);
    });

    it('is unsupported inside a container', async () => {
      const exists = (p) => p === '/.dockerenv' || opts.exists(p);
      const s = await installer.getStatus({ ...opts, exists });
      expect(s.status).toBe('unsupported');
      expect(s.reason).toMatch(/container/);
    });
  });

  describe('install', () => {
    it('installs fresh: script written executable, three canonical entries', async () => {
      const s = await installer.install(opts);
      expect(s.status).toBe('installed');
      const script = hookScriptPath(home);
      expect(fs.readFileSync(script, 'utf-8')).toBe(HOOK_SCRIPT);
      expect(fs.statSync(script).mode & 0o111).not.toBe(0);
      const settings = readSettings();
      expect(commands(settings, 'Notification')).toEqual([`"${script}"`]);
      expect(commands(settings, 'UserPromptSubmit')).toEqual([`"${script}" working`]);
      expect(commands(settings, 'Stop')).toEqual([`"${script}" idle`]);
      expect(settings.hooks.Notification[0].matcher).toBe('permission_prompt|idle_prompt');
    });

    it('creates ~/.claude when it does not exist', async () => {
      expect(fs.existsSync(path.join(home, '.claude'))).toBe(false);
      expect((await installer.install(opts)).status).toBe('installed');
    });

    it('repairs legacy entries and keeps unrelated hooks and settings', async () => {
      writeSettings({
        model: 'opus',
        permissions: { allow: ['Bash(ls)'] },
        hooks: {
          Notification: [entry(legacy(), 'permission_prompt|idle_prompt')],
          UserPromptSubmit: [entry(legacy(' working'))],
          Stop: [userStop, entry(legacy(' idle'))],
          PreToolUse: [entry('echo pre')],
        },
      });
      expect((await installer.install(opts)).status).toBe('installed');
      const s = readSettings();
      expect(JSON.stringify(s)).not.toMatch(/old\/checkout/);
      expect(s.model).toBe('opus');
      expect(s.permissions).toEqual({ allow: ['Bash(ls)'] });
      expect(s.hooks.PreToolUse).toEqual([entry('echo pre')]);
      expect(commands(s, 'Stop')).toEqual(['echo unrelated-user-hook', `"${hookScriptPath(home)}" idle`]);
    });

    it('keeps a user hook that shares an entry with a legacy LaunchPad hook', async () => {
      writeSettings({ hooks: { Stop: [{ matcher: '', hooks: [
        { type: 'command', command: 'echo mine' },
        { type: 'command', command: legacy(' idle') },
      ] }] } });
      await installer.install(opts);
      expect(commands(readSettings(), 'Stop')).toEqual(['echo mine', `"${hookScriptPath(home)}" idle`]);
    });

    it('is idempotent: a second install leaves settings.json byte-identical', async () => {
      writeSettings({ hooks: { Stop: [userStop] } });
      await installer.install(opts);
      const before = fs.readFileSync(settingsPath(home), 'utf-8');
      await installer.install(opts);
      expect(fs.readFileSync(settingsPath(home), 'utf-8')).toBe(before);
    });

    it('backs up settings.json before modifying it', async () => {
      const original = JSON.stringify({ hooks: { Stop: [userStop] } }, null, 2);
      writeSettings(original);
      await installer.install(opts);
      expect(fs.readFileSync(`${settingsPath(home)}.launchpad.bak`, 'utf-8')).toBe(original);
    });

    it('refuses invalid JSON and leaves the file untouched', async () => {
      writeSettings('{ not json');
      await expect(installer.install(opts)).rejects.toThrow(/not valid JSON/);
      expect(fs.readFileSync(settingsPath(home), 'utf-8')).toBe('{ not json');
      expect(fs.existsSync(hookScriptPath(home))).toBe(false);
    });

    it('refuses when unsupported', async () => {
      await expect(installer.install({ ...opts, platform: 'win32' })).rejects.toMatchObject({ code: 'UNSUPPORTED' });
      expect(fs.existsSync(settingsPath(home))).toBe(false);
    });
  });

  describe('remove', () => {
    it('removes only LaunchPad entries, prunes empties, deletes the launchpad dir', async () => {
      writeSettings({ model: 'x', hooks: { Stop: [userStop], Notification: [entry(legacy())] } });
      await installer.install(opts);
      const s = await installer.remove(opts);
      expect(s.status).toBe('not-installed');
      const settings = readSettings();
      expect(settings).toEqual({ model: 'x', hooks: { Stop: [userStop] } });
      expect(fs.existsSync(launchpadDir(home))).toBe(false);
    });

    it('deletes an empty hooks object', async () => {
      await installer.install(opts);
      await installer.remove(opts);
      expect(readSettings()).toEqual({});
    });

    it('is a no-op without settings.json', async () => {
      expect((await installer.remove(opts)).status).toBe('not-installed');
      expect(fs.existsSync(settingsPath(home))).toBe(false);
    });
  });

  describe('refreshScript', () => {
    it('rewrites an outdated script when hooks are installed, without touching settings', async () => {
      await installer.install(opts);
      fs.writeFileSync(hookScriptPath(home), '#!/bin/sh\n# old version\n');
      const settingsBefore = fs.readFileSync(settingsPath(home), 'utf-8');
      expect(await installer.refreshScript(opts)).toBe(true);
      expect(fs.readFileSync(hookScriptPath(home), 'utf-8')).toBe(HOOK_SCRIPT);
      expect(fs.readFileSync(settingsPath(home), 'utf-8')).toBe(settingsBefore);
    });

    it('does nothing when the script is current', async () => {
      await installer.install(opts);
      expect(await installer.refreshScript(opts)).toBe(false);
    });

    it('does nothing when hooks are not installed', async () => {
      writeSettings({ hooks: { Stop: [userStop] } });
      expect(await installer.refreshScript(opts)).toBe(false);
      expect(fs.existsSync(launchpadDir(home))).toBe(false);
    });
  });
});
