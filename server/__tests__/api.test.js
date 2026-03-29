/**
 * API endpoint tests using supertest
 * Tests the Express server endpoints without starting the actual server
 */
const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock workspaceScanner to avoid filesystem dependencies
jest.mock('../workspaceScanner', () => ({
  initialize: jest.fn().mockResolvedValue(undefined),
  scanWorkspaces: jest.fn().mockResolvedValue([]),
  validatePath: jest.fn().mockResolvedValue(true),
  validatePaths: jest.fn().mockResolvedValue({}),
  removeWorkspacesFromPath: jest.fn().mockResolvedValue({ success: true, removed: 0 }),
}));

jest.mock('../claudeSessionScanner', () => ({
  initialize: jest.fn().mockResolvedValue(undefined),
  getSessions: jest.fn().mockReturnValue({ hookConfigured: false, sessions: [] }),
  killSessions: jest.fn().mockResolvedValue({ killed: [], failed: [] }),
}));

const workspaceScanner = require('../workspaceScanner');
const claudeSessionScanner = require('../claudeSessionScanner');

// Create a test app (same setup as server/index.js but without listen())
function createTestApp() {
  const app = express();
  const PORT = 3010;
  const DEV_PORT = 3020;

  app.use(express.json());

  // CORS middleware
  app.use((req, res, next) => {
    const allowedOrigins = [
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${PORT}`,
      `http://localhost:${DEV_PORT}`,
      `http://127.0.0.1:${DEV_PORT}`,
      'tauri://localhost',
      'https://tauri.localhost'
    ];

    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      res.header('Access-Control-Allow-Origin', '');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Get workspaces
  app.get('/api/workspaces', async (req, res) => {
    try {
      const workspaces = await workspaceScanner.scanWorkspaces();
      res.json(workspaces);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch workspaces', details: error.message });
    }
  });

  // Validate single path
  app.post('/api/validate-path', async (req, res) => {
    try {
      const { path: workspacePath } = req.body;
      if (!workspacePath) {
        return res.status(400).json({ error: 'Path is required' });
      }
      const isValid = await workspaceScanner.validatePath(workspacePath);
      res.json({ path: workspacePath, valid: isValid });
    } catch (error) {
      res.status(500).json({ error: 'Failed to validate path' });
    }
  });

  // Validate multiple paths
  app.post('/api/validate-paths', async (req, res) => {
    try {
      const { workspaces } = req.body;
      if (!Array.isArray(workspaces)) {
        return res.status(400).json({ error: 'Workspaces array is required' });
      }
      const results = await workspaceScanner.validatePaths(workspaces);
      res.json({ results });
    } catch (error) {
      res.status(500).json({ error: 'Failed to validate paths' });
    }
  });

  // Claude sessions
  app.get('/api/claude-sessions', (req, res) => {
    try {
      const data = claudeSessionScanner.getSessions();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch Claude sessions' });
    }
  });

  // Kill zombie Claude sessions
  app.post('/api/claude-sessions/kill', async (req, res) => {
    try {
      const { pids } = req.body;
      if (!Array.isArray(pids) || pids.length === 0) {
        return res.status(400).json({ error: 'PIDs array is required' });
      }
      const result = await claudeSessionScanner.killSessions(pids);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to kill sessions' });
    }
  });

  // Delete workspaces
  app.post('/api/workspaces/delete', async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Workspace IDs array is required' });
      }
      const result = await workspaceScanner.removeWorkspacesFromPath(ids);
      if (result.success) {
        res.json({
          success: true,
          removed: result.removed,
          message: `Successfully removed ${result.removed} workspace(s)`
        });
      } else {
        res.status(400).json({
          success: false,
          removed: result.removed,
          errors: result.errors
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete workspaces' });
    }
  });

  return app;
}

let app;

beforeAll(() => {
  app = createTestApp();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Health check endpoint', () => {
  it('GET /health returns healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.timestamp).toBeDefined();
  });
});

describe('Spec: GET /api/workspaces returns workspace list', () => {
  it('returns 200 with empty array when no workspaces', async () => {
    workspaceScanner.scanWorkspaces.mockResolvedValue([]);

    const response = await request(app).get('/api/workspaces');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('returns 200 with workspace array', async () => {
    const mockWorkspaces = [
      {
        id: 'ws-1',
        name: 'My Project',
        path: '/Users/dev/my-project',
        type: 'local',
        lastAccessed: '2024-01-15T10:00:00Z',
      },
    ];
    workspaceScanner.scanWorkspaces.mockResolvedValue(mockWorkspaces);

    const response = await request(app).get('/api/workspaces');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('My Project');
  });

  it('returns 500 when scanner throws error', async () => {
    workspaceScanner.scanWorkspaces.mockRejectedValue(new Error('Scanner failed'));

    const response = await request(app).get('/api/workspaces');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to fetch workspaces');
  });

  it('returns JSON content type', async () => {
    workspaceScanner.scanWorkspaces.mockResolvedValue([]);

    const response = await request(app).get('/api/workspaces');

    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('Spec: CORS headers are properly configured', () => {
  it('returns CORS headers for allowed origin', async () => {
    workspaceScanner.scanWorkspaces.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/workspaces')
      .set('Origin', 'http://localhost:3010');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3010');
    expect(response.headers['access-control-allow-methods']).toContain('GET');
  });

  it('handles OPTIONS preflight request', async () => {
    const response = await request(app)
      .options('/api/workspaces')
      .set('Origin', 'http://localhost:3010');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-methods']).toContain('GET');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('blocks unknown origins', async () => {
    workspaceScanner.scanWorkspaces.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/workspaces')
      .set('Origin', 'http://evil.com');

    // Unknown origins should get empty CORS header
    expect(response.headers['access-control-allow-origin']).toBe('');
  });

  it('allows tauri://localhost origin', async () => {
    workspaceScanner.scanWorkspaces.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/workspaces')
      .set('Origin', 'tauri://localhost');

    expect(response.headers['access-control-allow-origin']).toBe('tauri://localhost');
  });
});

describe('Spec: POST /api/validate-path', () => {
  it('returns valid: true for existing path', async () => {
    workspaceScanner.validatePath.mockResolvedValue(true);

    const response = await request(app)
      .post('/api/validate-path')
      .send({ path: '/Users/dev/my-project' });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.path).toBe('/Users/dev/my-project');
  });

  it('returns valid: false for non-existing path', async () => {
    workspaceScanner.validatePath.mockResolvedValue(false);

    const response = await request(app)
      .post('/api/validate-path')
      .send({ path: '/non/existent/path' });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(false);
  });

  it('returns 400 when path is missing', async () => {
    const response = await request(app)
      .post('/api/validate-path')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Path is required');
  });
});

describe('Spec: POST /api/validate-paths (batch)', () => {
  it('validates multiple paths', async () => {
    workspaceScanner.validatePaths.mockResolvedValue({
      'ws-1': true,
      'ws-2': false,
    });

    const response = await request(app)
      .post('/api/validate-paths')
      .send({
        workspaces: [
          { id: 'ws-1', path: '/valid/path' },
          { id: 'ws-2', path: '/invalid/path' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.results['ws-1']).toBe(true);
    expect(response.body.results['ws-2']).toBe(false);
  });

  it('returns 400 when workspaces is not an array', async () => {
    const response = await request(app)
      .post('/api/validate-paths')
      .send({ workspaces: 'not-an-array' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Workspaces array is required');
  });
});

describe('Spec: POST /api/workspaces/delete', () => {
  it('deletes workspaces successfully', async () => {
    workspaceScanner.removeWorkspacesFromPath.mockResolvedValue({
      success: true,
      removed: 2,
    });

    const response = await request(app)
      .post('/api/workspaces/delete')
      .send({ ids: ['ws-1', 'ws-2'] });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.removed).toBe(2);
  });

  it('returns 400 when ids array is empty', async () => {
    const response = await request(app)
      .post('/api/workspaces/delete')
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Workspace IDs array is required');
  });

  it('returns 400 when ids is not an array', async () => {
    const response = await request(app)
      .post('/api/workspaces/delete')
      .send({ ids: 'not-an-array' });

    expect(response.status).toBe(400);
  });
});

describe('Spec: GET /api/claude-sessions', () => {
  it('returns hookConfigured and sessions', async () => {
    claudeSessionScanner.getSessions.mockReturnValue({ hookConfigured: false, sessions: [] });

    const response = await request(app).get('/api/claude-sessions');

    expect(response.status).toBe(200);
    expect(response.body.hookConfigured).toBe(false);
    expect(response.body.sessions).toEqual([]);
  });

  it('returns sessions when hooks configured', async () => {
    claudeSessionScanner.getSessions.mockReturnValue({
      hookConfigured: true,
      sessions: [{
        pid: 12345, sessionId: 'test-id', cwd: '/project',
        startedAt: 1700000000000, entrypoint: 'cli', state: 'working',
      }],
    });

    const response = await request(app).get('/api/claude-sessions');

    expect(response.status).toBe(200);
    expect(response.body.hookConfigured).toBe(true);
    expect(response.body.sessions).toHaveLength(1);
    expect(response.body.sessions[0].state).toBe('working');
  });

  it('returns 500 when scanner throws', async () => {
    claudeSessionScanner.getSessions.mockImplementation(() => { throw new Error('fail'); });

    const response = await request(app).get('/api/claude-sessions');
    expect(response.status).toBe(500);
  });
});

describe('Spec: POST /api/claude-sessions/kill', () => {
  it('kills valid PIDs', async () => {
    claudeSessionScanner.killSessions.mockResolvedValue({ killed: [123], failed: [] });

    const response = await request(app)
      .post('/api/claude-sessions/kill')
      .send({ pids: [123] });

    expect(response.status).toBe(200);
    expect(response.body.killed).toEqual([123]);
  });

  it('returns 400 for missing pids', async () => {
    const response = await request(app)
      .post('/api/claude-sessions/kill')
      .send({});

    expect(response.status).toBe(400);
  });
});
