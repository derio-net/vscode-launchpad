const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { pathExists } = require('fs-extra');

// In-memory cache for workspaces
let workspacesCache = [];

/**
 * Get the workspace storage path based on platform
 * Supports macOS, Windows, and Linux with XDG compliance
 */
const getWorkspaceStoragePath = () => {
  // Allow override via environment variable
  // WORKSPACES_MOUNT_POINT is the canonical variable (used by .env, Tauri, and Docker)
  // WORKSPACES_PATH is kept as a legacy fallback for backward compatibility
  const envOverride = process.env.WORKSPACES_MOUNT_POINT || process.env.WORKSPACES_PATH;
  if (envOverride) {
    const overridePath = path.normalize(envOverride);
    const varName = process.env.WORKSPACES_MOUNT_POINT ? 'WORKSPACES_MOUNT_POINT' : 'WORKSPACES_PATH';
    console.log(`Using ${varName} override: ${overridePath}`);
    return overridePath;
  }

  const platform = process.platform;
  const home = os.homedir();
  let workspacePath;

  switch (platform) {
    case 'darwin':
      // macOS: ~/Library/Application Support/Code/User/workspaceStorage
      workspacePath = path.join(
        home,
        'Library',
        'Application Support',
        'Code',
        'User',
        'workspaceStorage'
      );
      break;

    case 'win32':
      // Windows: %APPDATA%\Code\User\workspaceStorage
      // Use APPDATA env var if available, otherwise construct from home
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      workspacePath = path.join(appData, 'Code', 'User', 'workspaceStorage');
      break;

    case 'linux':
      // Linux: ~/.config/Code/User/workspaceStorage
      // Support XDG Base Directory specification
      const configHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
      workspacePath = path.join(configHome, 'Code', 'User', 'workspaceStorage');
      break;

    case 'freebsd':
    case 'openbsd':
    case 'netbsd':
      // BSD variants - use Linux path logic with warning
      console.warn(`Platform '${platform}' is not officially supported. Using Linux path logic.`);
      const bsdConfigHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
      workspacePath = path.join(bsdConfigHome, 'Code', 'User', 'workspaceStorage');
      break;

    default:
      throw new Error(`Unsupported platform: ${platform}. Supported platforms: darwin (macOS), win32 (Windows), linux`);
  }

  // Normalize the path to handle any mixed separators
  return path.normalize(workspacePath);
};

/**
 * Validate that the workspace path exists
 */
const validateWorkspacePath = async (workspacePath) => {
  try {
    await fs.access(workspacePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate a single workspace path (for API)
 * @param {string} workspacePath - Path to validate
 * @returns {Promise<boolean>} - True if path exists
 */
async function validatePath(workspacePath) {
  if (!workspacePath || typeof workspacePath !== 'string') {
    return false;
  }
  
  // Skip validation for remote URLs
  if (workspacePath.startsWith('http://') || 
      workspacePath.startsWith('https://') ||
      workspacePath.startsWith('vscode://') ||
      workspacePath.startsWith('vscode-remote://')) {
    return true; // Consider remote paths as valid
  }
  
  // Handle file:// prefix
  let cleanPath = workspacePath;
  if (cleanPath.startsWith('file://')) {
    cleanPath = cleanPath.substring(7);
  }
  
  // Decode URL-encoded characters
  try {
    cleanPath = decodeURIComponent(cleanPath);
  } catch (e) {
    // If decoding fails, use original path
  }
  
  try {
    return await pathExists(cleanPath);
  } catch {
    return false;
  }
}

/**
 * Validate multiple workspace paths in batch
 * @param {Array<{id: string, path: string}>} workspaces - Array of workspace objects
 * @returns {Promise<Object>} - Map of workspace id to validation result
 */
async function validatePaths(workspaces) {
  const results = {};
  
  for (const workspace of workspaces) {
    if (!workspace || !workspace.id || !workspace.path) {
      continue;
    }
    results[workspace.id] = await validatePath(workspace.path);
  }
  
  return results;
}

// Refresh interval (30 seconds)
const REFRESH_INTERVAL = 30000;

/**
 * Parse workspace type from URI
 */
function parseWorkspaceType(uri) {
  if (uri.startsWith('file://')) {
    return 'local';
  } else if (uri.includes('vscode-remote://dev-container')) {
    return 'dev-container';
  } else if (uri.includes('vscode-remote://attached-container')) {
    return 'attached-container';
  } else if (uri.includes('vscode-remote://ssh-remote')) {
    return 'ssh-remote';
  } else if (uri.startsWith('vscode-remote://')) {
    return 'remote';
  }
  return 'unknown';
}

/**
 * Extract workspace name from path
 */
function extractWorkspaceName(uri) {
  try {
    // Decode URI components
    const decoded = decodeURIComponent(uri);
    
    // Extract the last part of the path
    const parts = decoded.split('/');
    const lastPart = parts[parts.length - 1];
    
    // Remove file extension if present
    return lastPart.replace(/\.(code-workspace|json)$/, '');
  } catch (error) {
    console.error('Error extracting workspace name:', error);
    return 'Unknown';
  }
}

/**
 * Parse workspace JSON file
 */
function parseWorkspaceData(workspaceJson, workspaceDir, stats) {
  try {
    const data = JSON.parse(workspaceJson);
    let uri = null;
    let type = 'unknown';
    let name = 'Unknown';
    
    // Check for workspace or folder property
    if (data.workspace) {
      uri = data.workspace;
      type = parseWorkspaceType(uri);
      name = extractWorkspaceName(uri);
    } else if (data.folder) {
      uri = data.folder;
      type = parseWorkspaceType(uri);
      name = extractWorkspaceName(uri);
    }
    
    return {
      id: path.basename(workspaceDir),
      name,
      path: uri || 'Unknown',
      type,
      lastModified: stats.mtime.toISOString(),
      storageDir: workspaceDir
    };
  } catch (error) {
    console.error(`Error parsing workspace data:`, error);
    return null;
  }
}

/**
 * Scan a single workspace directory
 */
async function scanWorkspaceDirectory(workspaceDir) {
  try {
    const workspaceJsonPath = path.join(workspaceDir, 'workspace.json');
    
    // Check if workspace.json exists
    try {
      await fs.access(workspaceJsonPath);
    } catch {
      // workspace.json doesn't exist, skip this directory
      return null;
    }
    
    // Read workspace.json
    const workspaceJson = await fs.readFile(workspaceJsonPath, 'utf8');
    const stats = await fs.stat(workspaceJsonPath);
    
    return parseWorkspaceData(workspaceJson, workspaceDir, stats);
  } catch (error) {
    console.error(`Error scanning workspace directory ${workspaceDir}:`, error.message);
    return null;
  }
}

/**
 * Scan all workspace directories
 */
async function scanWorkspaces() {
  try {
    const WORKSPACE_STORAGE_PATH = getWorkspaceStoragePath();
    
    // Check if workspace storage directory exists
    try {
      await fs.access(WORKSPACE_STORAGE_PATH);
    } catch {
      console.error(`Workspace storage directory not found: ${WORKSPACE_STORAGE_PATH}`);
      return [];
    }
    
    // Read all subdirectories
    const entries = await fs.readdir(WORKSPACE_STORAGE_PATH, { withFileTypes: true });
    const workspaceDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(WORKSPACE_STORAGE_PATH, entry.name));
    
    // Scan each workspace directory
    const workspacePromises = workspaceDirs.map(scanWorkspaceDirectory);
    const workspaces = await Promise.all(workspacePromises);
    
    // Filter out null results (failed scans)
    const validWorkspaces = workspaces.filter(ws => ws !== null);
    
    // Log if some workspaces failed to parse
    const failedCount = workspaces.length - validWorkspaces.length;
    if (failedCount > 0) {
      console.warn(`Warning: ${failedCount} workspace(s) failed to parse and were skipped`);
    }
    
    return validWorkspaces;
  } catch (error) {
    console.error('Error scanning workspaces:', error);
    // Re-throw the error so the API can return a proper 500 status
    throw error;
  }
}

/**
 * Refresh workspaces cache
 */
async function refreshWorkspaces() {
  console.log('Refreshing workspaces...');
  workspacesCache = await scanWorkspaces();
  console.log(`Found ${workspacesCache.length} workspaces`);
}

/**
 * Initialize workspace scanner
 */
async function initialize() {
  console.log('Initializing workspace scanner...');
  console.log(`Detected platform: ${process.platform}`);
  
  const WORKSPACE_STORAGE_PATH = getWorkspaceStoragePath();
  console.log(`Workspace storage path: ${WORKSPACE_STORAGE_PATH}`);
  
  // Validate the workspace path exists
  const pathExists = await validateWorkspacePath(WORKSPACE_STORAGE_PATH);
  if (!pathExists) {
    console.warn(`Workspace storage directory not found: ${WORKSPACE_STORAGE_PATH}`);
    console.warn('This is normal if VS Code has not been used yet or workspaces have not been created.');
  }
  
  // Initial scan
  await refreshWorkspaces();
  
  // Set up periodic refresh
  setInterval(refreshWorkspaces, REFRESH_INTERVAL);
  
  console.log(`Workspace scanner initialized. Refresh interval: ${REFRESH_INTERVAL}ms`);
}

/**
 * Get cached workspaces
 */
function getWorkspaces() {
  return workspacesCache;
}

/**
 * Remove workspaces from the OS Path environment variable
 * @param {Array<string>} workspaceIds - Array of workspace IDs to remove
 * @returns {Promise<{success: boolean, removed: number, errors: Array<string>}>}
 */
async function removeWorkspacesFromPath(workspaceIds) {
  console.log('[WorkspaceScanner] removeWorkspacesFromPath called with IDs:', workspaceIds);
  
  if (!Array.isArray(workspaceIds) || workspaceIds.length === 0) {
    console.log('[WorkspaceScanner] No workspace IDs provided');
    return { success: false, removed: 0, errors: ['No workspace IDs provided'] };
  }

  const errors = [];
  let removed = 0;

  // Get current workspaces
  const currentWorkspaces = getWorkspaces();
  console.log('[WorkspaceScanner] Current workspaces count:', currentWorkspaces.length);
  console.log('[WorkspaceScanner] Current workspace IDs:', currentWorkspaces.map(ws => ws.id));
  
  // Validate that all workspaces exist in the current list
  const validIds = workspaceIds.filter(id => {
    const exists = currentWorkspaces.some(ws => ws.id === id);
    if (!exists) {
      console.log(`[WorkspaceScanner] Workspace ${id} not found in current list`);
      errors.push(`Workspace ${id} not found`);
    }
    return exists;
  });

  console.log('[WorkspaceScanner] Valid IDs after filtering:', validIds);

  if (validIds.length === 0) {
    console.log('[WorkspaceScanner] No valid IDs to delete');
    return { success: false, removed: 0, errors };
  }

  // Get the workspace storage path
  const WORKSPACE_STORAGE_PATH = getWorkspaceStoragePath();
  console.log('[WorkspaceScanner] Workspace storage path:', WORKSPACE_STORAGE_PATH);

  // Remove each workspace directory
  for (const id of validIds) {
    try {
      const workspaceDir = path.join(WORKSPACE_STORAGE_PATH, id);
      console.log(`[WorkspaceScanner] Attempting to delete: ${workspaceDir}`);
      
      // Check if directory exists before attempting to delete
      const dirExists = await fs.access(workspaceDir).then(() => true).catch(() => false);
      if (!dirExists) {
        console.warn(`[WorkspaceScanner] Workspace directory not found: ${workspaceDir}`);
        errors.push(`Workspace directory not found: ${workspaceDir}`);
        continue;
      }
      
      await fs.rm(workspaceDir, { recursive: true, force: true });
      console.log(`[WorkspaceScanner] Successfully deleted: ${workspaceDir}`);
      removed++;
    } catch (error) {
      console.error(`[WorkspaceScanner] Failed to delete workspace ${id}:`, error);
      errors.push(`Failed to remove workspace ${id}: ${error.message}`);
    }
  }

  // Refresh the cache after deletion
  console.log('[WorkspaceScanner] Refreshing workspace cache after deletion');
  await refreshWorkspaces();

  const result = {
    success: errors.length === 0,
    removed,
    errors: errors.length > 0 ? errors : undefined
  };
  console.log('[WorkspaceScanner] Final result:', result);
  
  return result;
}

module.exports = {
  initialize,
  getWorkspaces,
  refreshWorkspaces,
  scanWorkspaces,
  validatePath,
  validatePaths,
  removeWorkspacesFromPath
};
