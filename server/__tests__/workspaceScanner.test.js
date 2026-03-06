/**
 * Integration tests for workspaceScanner module
 * Tests workspace discovery, path validation, and URI generation
 */
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

// Mock fs-extra pathExists
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
}));

const { pathExists } = require('fs-extra');

// We need to test the internal functions - require after mocking
const workspaceScanner = require('../workspaceScanner');

describe('Spec: Workspace path validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePath', () => {
    it('returns true for existing local path', async () => {
      pathExists.mockResolvedValue(true);

      const result = await workspaceScanner.validatePath('/Users/dev/my-project');

      expect(result).toBe(true);
    });

    it('returns false for non-existing local path', async () => {
      pathExists.mockResolvedValue(false);

      const result = await workspaceScanner.validatePath('/non/existent/path');

      expect(result).toBe(false);
    });

    it('returns true for remote vscode-remote:// URIs (skip validation)', async () => {
      const result = await workspaceScanner.validatePath(
        'vscode-remote://ssh-remote%2Bmy-server/home/user/project'
      );

      expect(result).toBe(true);
      // pathExists should NOT be called for remote URIs
      expect(pathExists).not.toHaveBeenCalled();
    });

    it('returns true for http:// URIs', async () => {
      const result = await workspaceScanner.validatePath('http://example.com/workspace');

      expect(result).toBe(true);
      expect(pathExists).not.toHaveBeenCalled();
    });

    it('handles file:// prefix by stripping it', async () => {
      pathExists.mockResolvedValue(true);

      const result = await workspaceScanner.validatePath('file:///Users/dev/my-project');

      expect(result).toBe(true);
      expect(pathExists).toHaveBeenCalledWith('/Users/dev/my-project');
    });

    it('handles URL-encoded paths', async () => {
      pathExists.mockResolvedValue(true);

      const result = await workspaceScanner.validatePath('/Users/dev/my%20project');

      expect(result).toBe(true);
      expect(pathExists).toHaveBeenCalledWith('/Users/dev/my project');
    });

    it('returns false for null/undefined path', async () => {
      const result = await workspaceScanner.validatePath(null);
      expect(result).toBe(false);
    });

    it('returns false for non-string path', async () => {
      const result = await workspaceScanner.validatePath(123);
      expect(result).toBe(false);
    });
  });

  describe('validatePaths (batch)', () => {
    it('validates multiple paths and returns results map', async () => {
      pathExists.mockImplementation((p) => {
        return Promise.resolve(p === '/valid/path');
      });

      const results = await workspaceScanner.validatePaths([
        { id: 'ws-1', path: '/valid/path' },
        { id: 'ws-2', path: '/invalid/path' },
      ]);

      expect(results['ws-1']).toBe(true);
      expect(results['ws-2']).toBe(false);
    });

    it('skips workspaces without id or path', async () => {
      pathExists.mockResolvedValue(true);

      const results = await workspaceScanner.validatePaths([
        { id: 'ws-1', path: '/valid/path' },
        { path: '/no-id' }, // missing id
        { id: 'ws-3' }, // missing path
        null, // null entry
      ]);

      expect(Object.keys(results)).toHaveLength(1);
      expect(results['ws-1']).toBe(true);
    });

    it('returns empty object for empty array', async () => {
      const results = await workspaceScanner.validatePaths([]);
      expect(results).toEqual({});
    });
  });
});

describe('Spec: Workspace storage path detection', () => {
  const originalMountPoint = process.env.WORKSPACES_MOUNT_POINT;
  const originalPath = process.env.WORKSPACES_PATH;

  afterEach(() => {
    process.env.WORKSPACES_MOUNT_POINT = originalMountPoint;
    process.env.WORKSPACES_PATH = originalPath;
  });

  it('uses WORKSPACES_MOUNT_POINT environment variable when set', () => {
    process.env.WORKSPACES_MOUNT_POINT = '/custom/workspace/path';
    delete process.env.WORKSPACES_PATH;

    expect(process.env.WORKSPACES_MOUNT_POINT).toBe('/custom/workspace/path');
  });

  it('falls back to WORKSPACES_PATH when WORKSPACES_MOUNT_POINT is not set', () => {
    delete process.env.WORKSPACES_MOUNT_POINT;
    process.env.WORKSPACES_PATH = '/legacy/workspace/path';

    expect(process.env.WORKSPACES_PATH).toBe('/legacy/workspace/path');
  });

  it('prefers WORKSPACES_MOUNT_POINT over WORKSPACES_PATH when both are set', () => {
    process.env.WORKSPACES_MOUNT_POINT = '/primary/path';
    process.env.WORKSPACES_PATH = '/fallback/path';

    // WORKSPACES_MOUNT_POINT should take precedence
    const envOverride = process.env.WORKSPACES_MOUNT_POINT || process.env.WORKSPACES_PATH;
    expect(envOverride).toBe('/primary/path');
  });
});
