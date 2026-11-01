const express = require('express');

/**
 * REST routes for LaunchPad's Claude Code hook (mounted at /api/claude-hooks).
 *
 * The POSTs change the user's ~/.claude config, so they require
 * `Content-Type: application/json`. A cross-origin request with that type
 * needs a CORS preflight, which the server's origin allowlist rejects, so an
 * arbitrary web page cannot trigger them through localhost.
 *
 * `onChange` runs after a successful install/remove (e.g. to rescan sessions
 * so the UI updates without waiting for the next poll).
 */
const ERROR_STATUS = { UNSUPPORTED: 409, INVALID_SETTINGS: 422 };

function createClaudeHookRouter({ installer, onChange = () => {}, log = console }) {
  const router = express.Router();

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
      if (!req.is('application/json')) {
        return res.status(415).json({ error: 'Content-Type must be application/json' });
      }
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
