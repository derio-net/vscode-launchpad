import { getClaudeHooks, installClaudeHooks, removeClaudeHooks } from '../client';

const jsonResponse = (body, status = 200) => ({
  ok: status < 400,
  status,
  statusText: 'x',
  headers: { get: () => 'application/json' },
  json: async () => body,
});

describe.each([
  ['browser', undefined],
  ['tauri', {}],
])('Claude hook API client (%s mode)', (_mode, tauriGlobal) => {
  beforeEach(() => {
    global.fetch = jest.fn();
    window.__TAURI__ = tauriGlobal;
  });
  afterEach(() => {
    delete window.__TAURI__;
  });

  it('getClaudeHooks GETs /api/claude-hooks', async () => {
    fetch.mockResolvedValue(jsonResponse({ status: 'installed' }));
    await expect(getClaudeHooks()).resolves.toEqual({ status: 'installed' });
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/claude-hooks$/);
    expect(fetch.mock.calls[0][1].method).toBe('GET');
  });

  it.each([
    ['installClaudeHooks', installClaudeHooks, 'install'],
    ['removeClaudeHooks', removeClaudeHooks, 'remove'],
  ])('%s POSTs JSON to /api/claude-hooks/%s', async (_n, fn, action) => {
    fetch.mockResolvedValue(jsonResponse({ status: 'x' }));
    await fn();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(new RegExp(`/api/claude-hooks/${action}$`));
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{}');
  });

  it('surfaces the server error message without retrying', async () => {
    fetch.mockResolvedValue(jsonResponse({ error: 'settings.json is not valid JSON' }, 422));
    await expect(installClaudeHooks()).rejects.toThrow('settings.json is not valid JSON');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
