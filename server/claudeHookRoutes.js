const express = require('express');

/**
 * REST routes for LaunchPad's Claude Code hook (mounted at /api/claude-hooks).
 *
 * The POSTs change the user's ~/.claude config, so three checks guard them:
 * - `Host` must be a loopback name. Defeats DNS rebinding, where an attacker's
 *   hostname resolves to 127.0.0.1 and its requests become same-origin (no
 *   CORS preflight at all).
 * - `Origin`, when the browser sends one, must be in `allowedOrigins`.
 * - `Content-Type: application/json`: a cross-origin request with that type
 *   needs a CORS preflight, which the server's origin allowlist rejects.
 *
 * `onChange` runs after a successful install/remove (e.g. to rescan sessions
 * so the UI updates without waiting for the next poll).
 */
const ERROR_STATUS = { UNSUPPORTED: 409, INVALID_SETTINGS: 422 };
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'tauri.localhost']);

const hostnameOf = (hostHeader = '') => {
  const h = String(hostHeader).toLowerCase();
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1); // [::1]:3010
  return h.split(':')[0];
};

function createClaudeHookRouter({ installer, onChange = () => {}, log = console, allowedOrigins = [] }) {
  const router = express.Router();

  /** Sends a 403/415 and returns true when the request must not change config. */
  const rejectUntrusted = (req, res) => {
    if (!LOOPBACK_HOSTS.has(hostnameOf(req.headers.host))) {
      res.status(403).json({ error: 'Requests must be made to localhost' });
      return true;
    }
    const { origin } = req.headers;
    if (origin && !allowedOrigins.includes(origin)) {
      res.status(403).json({ error: 'Origin not allowed' });
      return true;
    }
    if (!req.is('application/json')) {
      res.status(415).json({ error: 'Content-Type must be application/json' });
      return true;
    }
    return false;
  };

  const fail = (res, error, action) => {
    const code = ERROR_STATUS[error && error.code];
    if (!code) log.error(`Claude hooks ${action} failed:`, error);
    res.status(code || 500).json({ error: error && error.message ? error.message : `Failed to ${action} hooks` });
  };

  router.get('/', async (req, res) => {
    try {
      res.json(await installer.getStatus());
    } catch (error) {
      fail(res, error, 'read');
    }
  });

  for (const action of ['install', 'remove']) {
    router.post(`/${action}`, async (req, res) => {
      if (rejectUntrusted(req, res)) return;
      try {
        const status = await installer[action]();
        await Promise.resolve(onChange()).catch(() => {});
        res.json(status);
      } catch (error) {
        fail(res, error, action);
      }
    });
  }

  return router;
}

module.exports = { createClaudeHookRouter };
