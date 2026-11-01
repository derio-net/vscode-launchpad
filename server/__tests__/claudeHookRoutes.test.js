/**
 * Spec: Hook management API (claude-hook-installer). The router is mounted on
 * a bare app with a fake installer.
 */
const request = require('supertest');
const express = require('express');
const { createClaudeHookRouter } = require('../claudeHookRoutes');
const { HookInstallerError } = require('../claudeHookInstaller');

const status = (s, extra = {}) => ({
  status: s, scriptPath: '/h/.claude/vscode-launchpad/hook.sh', legacy: false,
  events: { Notification: s === 'installed', UserPromptSubmit: s === 'installed', Stop: s === 'installed' },
  ...extra,
});

describe('Spec: Hook management API', () => {
  let installer, onChange, app;

  beforeEach(() => {
    installer = {
      getStatus: jest.fn().mockResolvedValue(status('not-installed')),
      install: jest.fn().mockResolvedValue(status('installed')),
      remove: jest.fn().mockResolvedValue(status('not-installed')),
    };
    onChange = jest.fn();
    app = express();
    app.use(express.json());
    app.use('/api/claude-hooks', createClaudeHookRouter({
      installer, onChange, log: { error: jest.fn() }, allowedOrigins: ['tauri://localhost'],
    }));
  });

  describe('request guard (DNS rebinding / cross-site)', () => {
    it.each(['install', 'remove'])('POST /%s refuses a non-loopback Host with 403', async (action) => {
      const res = await request(app).post(`/api/claude-hooks/${action}`).set('Host', 'evil.example:3010').send({});
      expect(res.status).toBe(403);
      expect(installer[action]).not.toHaveBeenCalled();
    });

    it('POST refuses an Origin outside the allowlist with 403', async () => {
      const res = await request(app).post('/api/claude-hooks/install').set('Origin', 'http://evil.example').send({});
      expect(res.status).toBe(403);
      expect(installer.install).not.toHaveBeenCalled();
    });

    it.each(['localhost:3010', '127.0.0.1:3010', '[::1]:3010', 'tauri.localhost'])('POST accepts Host %s', async (host) => {
      const res = await request(app).post('/api/claude-hooks/install').set('Host', host).send({});
      expect(res.status).toBe(200);
    });

    it('POST accepts an allowlisted Origin', async () => {
      const res = await request(app).post('/api/claude-hooks/install').set('Origin', 'tauri://localhost').send({});
      expect(res.status).toBe(200);
    });
  });

  it('GET returns status, scriptPath, legacy and per-event booleans', async () => {
    const res = await request(app).get('/api/claude-hooks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(status('not-installed'));
  });

  it('POST /install installs and returns the new status', async () => {
    const res = await request(app).post('/api/claude-hooks/install').send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('installed');
    expect(installer.install).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('POST /remove removes and returns the new status', async () => {
    const res = await request(app).post('/api/claude-hooks/remove').send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('not-installed');
    expect(installer.remove).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it.each(['install', 'remove'])('POST /%s refuses non-JSON content types with 415', async (action) => {
    const res = await request(app).post(`/api/claude-hooks/${action}`).set('Content-Type', 'text/plain').send('x');
    expect(res.status).toBe(415);
    expect(installer[action]).not.toHaveBeenCalled();
  });

  it.each(['install', 'remove'])('POST /%s returns 409 with the reason when unsupported', async (action) => {
    installer[action].mockRejectedValue(new HookInstallerError('Not on Windows', 'UNSUPPORTED'));
    const res = await request(app).post(`/api/claude-hooks/${action}`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Not on Windows');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('POST /install returns 422 when settings.json is invalid', async () => {
    installer.install.mockRejectedValue(new HookInstallerError('settings.json is not valid JSON', 'INVALID_SETTINGS'));
    const res = await request(app).post('/api/claude-hooks/install').send({});
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/not valid JSON/);
  });

  it('returns 500 with a message on unexpected errors', async () => {
    installer.getStatus.mockRejectedValue(new Error('EACCES'));
    const res = await request(app).get('/api/claude-hooks');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/EACCES/);
  });
});
