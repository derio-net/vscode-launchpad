import {
  decodeHexHost,
  formatConnectionInfo,
  extractConnectionInfo,
  extractSSHHost,
  extractWorkspacePath,
  toVSCodeUri,
  folderToVSCodeUri,
  openVSCodeUri,
} from './workspaceUtils';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

// Sample URIs matching real VS Code workspace storage formats
const REMOTE_ATTACHED_CONTAINER_URI =
  'vscode-remote://attached-container%2B7b22636f6e7461696e65724e616d65223a222f626f5f696e7374616c6c5f63757272656e74222c2273657474696e6773223a7b22686f7374223a22756e69783a2f2f2f72756e2f757365722f313030312f646f636b65722e736f636b227d7d@ssh-remote%2Bdev-server-01/opt/bo';

const LOCAL_ATTACHED_CONTAINER_URI =
  'vscode-remote://attached-container%2Babc123def/workspace/myproject';

const SSH_REMOTE_URI =
  'vscode-remote://ssh-remote%2Bmy-server/home/user/project';

const SSH_REMOTE_PLUS_URI =
  'vscode://vscode-remote/ssh-remote+my-server@/home/user/project';

const LOCAL_URI = 'file:///Users/dev/my%20project';

// Helper: hex-encode a string
function toHex(str) {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

describe('decodeHexHost', () => {
  it('decodes valid hex-encoded JSON with hostName only', () => {
    const hex = toHex('{"hostName":"my-server"}');
    expect(decodeHexHost(hex)).toEqual({ hostName: 'my-server' });
  });

  it('decodes hex JSON with hostName and user', () => {
    const hex = toHex('{"hostName":"build-server-01","user":"root"}');
    expect(decodeHexHost(hex)).toEqual({ hostName: 'build-server-01', user: 'root' });
  });

  it('decodes hex JSON with hostName, user, and port', () => {
    const hex = toHex('{"hostName":"server","user":"admin","port":2222}');
    expect(decodeHexHost(hex)).toEqual({ hostName: 'server', user: 'admin', port: 2222 });
  });

  it('decodes hex JSON with hostName and port only', () => {
    const hex = toHex('{"hostName":"server","port":22}');
    expect(decodeHexHost(hex)).toEqual({ hostName: 'server', port: 22 });
  });

  it('throws on invalid hex characters', () => {
    expect(() => decodeHexHost('ZZZZ')).toThrow();
  });

  it('throws on incomplete hex string (odd length)', () => {
    const hex = toHex('{"hostName":"x"}');
    expect(() => decodeHexHost(hex.slice(0, -1))).toThrow();
  });

  it('throws on valid hex that is not JSON', () => {
    const hex = toHex('not json at all');
    expect(() => decodeHexHost(hex)).toThrow();
  });

  it('throws on JSON without hostName field', () => {
    const hex = toHex('{"user":"root"}');
    expect(() => decodeHexHost(hex)).toThrow(/hostName/);
  });
});

describe('formatConnectionInfo', () => {
  it('formats hostName only', () => {
    expect(formatConnectionInfo({ hostName: 'my-server' })).toBe('my-server');
  });

  it('formats hostName + user', () => {
    expect(formatConnectionInfo({ hostName: 'build-server-01', user: 'root' })).toBe('root@build-server-01');
  });

  it('formats hostName + user + port', () => {
    expect(formatConnectionInfo({ hostName: 'server', user: 'admin', port: 2222 })).toBe('admin@server:2222');
  });

  it('formats hostName + port (no user)', () => {
    expect(formatConnectionInfo({ hostName: 'server', port: 22 })).toBe('server:22');
  });
});

describe('extractConnectionInfo', () => {
  it('decodes hex-encoded JSON host from ssh-remote URI', () => {
    const hex = toHex('{"hostName":"build-server-01","user":"root"}');
    const ws = { type: 'ssh-remote', path: `vscode-remote://ssh-remote%2B${hex}/opt/bo` };
    const result = extractConnectionInfo(ws);
    expect(result.display).toBe('root@build-server-01');
    expect(result.raw).toBe(hex);
    expect(result.error).toBeUndefined();
  });

  it('returns plain hostname for old-format ssh-remote URI', () => {
    const ws = { type: 'ssh-remote', path: SSH_REMOTE_URI };
    const result = extractConnectionInfo(ws);
    expect(result.display).toBe('my-server');
    expect(result.raw).toBeUndefined();
  });

  it('returns plain hostname from + literal URI', () => {
    const ws = { type: 'ssh-remote', path: SSH_REMOTE_PLUS_URI };
    expect(extractConnectionInfo(ws).display).toBe('my-server');
  });

  it('returns error on decode failure', () => {
    // 7b22 prefix but invalid JSON after that
    const badHex = '7b2200000000';
    const ws = { type: 'ssh-remote', path: `vscode-remote://ssh-remote%2B${badHex}/path` };
    const result = extractConnectionInfo(ws);
    expect(result.display).toBe('\u26a0 decode error');
    expect(result.error).toBe(true);
    expect(result.raw).toBe(badHex);
  });

  it('decodes hex host from attached-container on remote SSH host', () => {
    const hex = toHex('{"hostName":"remote-box","user":"deploy"}');
    const ws = {
      type: 'attached-container',
      path: `vscode-remote://attached-container%2Babc@ssh-remote%2B${hex}/opt/app`,
    };
    const result = extractConnectionInfo(ws);
    expect(result.display).toBe('deploy@remote-box');
  });

  it('returns plain hostname from attached-container on remote SSH host', () => {
    const ws = { type: 'attached-container', path: REMOTE_ATTACHED_CONTAINER_URI };
    expect(extractConnectionInfo(ws).display).toBe('dev-server-01');
  });

  it('returns empty display for local workspace', () => {
    const ws = { type: 'local', path: LOCAL_URI };
    expect(extractConnectionInfo(ws).display).toBe('');
  });

  it('returns empty display for attached container without SSH remote', () => {
    const ws = { type: 'attached-container', path: LOCAL_ATTACHED_CONTAINER_URI };
    expect(extractConnectionInfo(ws).display).toBe('');
  });
});

describe('extractSSHHost (deprecated alias)', () => {
  it('returns display string from extractConnectionInfo', () => {
    const ws = { type: 'ssh-remote', path: SSH_REMOTE_URI };
    expect(extractSSHHost(ws)).toBe('my-server');
  });

  it('extracts SSH host from attached container on remote SSH host', () => {
    const ws = { type: 'attached-container', path: REMOTE_ATTACHED_CONTAINER_URI };
    expect(extractSSHHost(ws)).toBe('dev-server-01');
  });

  it('returns empty string for local workspaces', () => {
    const ws = { type: 'local', path: LOCAL_URI };
    expect(extractSSHHost(ws)).toBe('');
  });

  it('URL-decodes the SSH host name', () => {
    const ws = {
      type: 'attached-container',
      path: 'vscode-remote://attached-container%2Babc@ssh-remote%2Bhost%2Ewith%2Edots/path',
    };
    expect(extractSSHHost(ws)).toBe('host.with.dots');
  });
});

describe('extractWorkspacePath', () => {
  // Spec: Requirement "Clean path extraction from remotely-attached container URIs"

  it('extracts path from attached container on remote SSH host', () => {
    const ws = { type: 'attached-container', path: REMOTE_ATTACHED_CONTAINER_URI };
    expect(extractWorkspacePath(ws)).toBe('/opt/bo');
  });

  it('extracts path from local attached container using +hex/path pattern', () => {
    const ws = { type: 'attached-container', path: LOCAL_ATTACHED_CONTAINER_URI };
    expect(extractWorkspacePath(ws)).toBe('/workspace/myproject');
  });

  // Regression: existing types still work
  it('extracts path from ssh-remote URI', () => {
    const ws = { type: 'ssh-remote', path: SSH_REMOTE_URI };
    expect(extractWorkspacePath(ws)).toBe('/home/user/project');
  });

  it('decodes local file:// URI', () => {
    const ws = { type: 'local', path: LOCAL_URI };
    expect(extractWorkspacePath(ws)).toBe('/Users/dev/my project');
  });
});

describe('sorting compatibility', () => {
  // Spec: Requirement "Sorting by SSH host includes remotely-attached containers"

  it('both ssh-remote and remote attached-container return non-empty display for sorting', () => {
    const attached = { type: 'attached-container', path: REMOTE_ATTACHED_CONTAINER_URI };
    const ssh = { type: 'ssh-remote', path: SSH_REMOTE_URI };

    const displayA = extractConnectionInfo(attached).display;
    const displayB = extractConnectionInfo(ssh).display;

    expect(displayA).toBeTruthy();
    expect(displayB).toBeTruthy();
    expect(typeof displayA).toBe('string');
    expect(typeof displayB).toBe('string');
  });
});


describe('folderToVSCodeUri', () => {
  it('builds a vscode://file URI for a plain path', () => {
    expect(folderToVSCodeUri('/Users/dev/tools/agent')).toBe('vscode://file/Users/dev/tools/agent');
  });

  it('encodes each segment but keeps the slashes', () => {
    expect(folderToVSCodeUri('/Users/dev/my project#2')).toBe('vscode://file/Users/dev/my%20project%232');
  });

  it('drops a trailing slash', () => {
    expect(folderToVSCodeUri('/Users/dev/agent/')).toBe('vscode://file/Users/dev/agent');
  });
});

describe('toVSCodeUri (moved from WorkspaceTable, unchanged behaviour)', () => {
  it('converts a local file:// workspace', () => {
    expect(toVSCodeUri({ type: 'local', path: 'file:///Users/dev/my%20proj' })).toBe('vscode://file/Users/dev/my%20proj');
  });

  it('converts a local path without file://', () => {
    expect(toVSCodeUri({ type: 'local', path: '/Users/dev/proj' })).toBe('vscode://file/Users/dev/proj');
  });

  it.each(['ssh-remote', 'dev-container', 'attached-container', 'remote'])(
    'rewrites vscode-remote:// to vscode://vscode-remote/ for %s', (type) => {
      expect(toVSCodeUri({ type, path: 'vscode-remote://ssh-remote%2Bhost/home/u/p' }))
        .toBe('vscode://vscode-remote/ssh-remote%2Bhost/home/u/p');
    });

  it('returns other remote paths as-is', () => {
    expect(toVSCodeUri({ type: 'ssh-remote', path: 'file:///x' })).toBe('file:///x');
  });
});

describe('openVSCodeUri', () => {
  afterEach(() => {
    delete window.__TAURI__;
    delete window.__TAURI_INTERNALS__;
    jest.clearAllMocks();
  });

  it('invokes open_vscode in Tauri mode', async () => {
    window.__TAURI_INTERNALS__ = {};
    invoke.mockResolvedValueOnce(null);
    await openVSCodeUri('vscode://file/x');
    expect(invoke).toHaveBeenCalledWith('open_vscode', { uri: 'vscode://file/x' });
    expect(open).not.toHaveBeenCalled();
  });

  it('falls back to the shell open when invoke fails', async () => {
    window.__TAURI__ = {};
    invoke.mockRejectedValueOnce(new Error('nope'));
    await openVSCodeUri('vscode://file/x');
    expect(open).toHaveBeenCalledWith('vscode://file/x');
  });

  it('navigates to the URI in browser mode', async () => {
    const navigate = jest.fn();
    await openVSCodeUri('vscode://file/x', { navigate });
    expect(navigate).toHaveBeenCalledWith('vscode://file/x');
    expect(invoke).not.toHaveBeenCalled();
  });
});
