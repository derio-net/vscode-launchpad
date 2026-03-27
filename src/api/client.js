/**
 * API Client for VS Code Launchpad
 * 
 * This client supports both Tauri desktop and browser development modes.
 * In Tauri mode, it uses the Tauri HTTP plugin for secure communication.
 * In browser mode, it falls back to native fetch.
 */

// Detect if running in Tauri environment
const isTauri = () => {
  return typeof window !== 'undefined' && 
         window.__TAURI__ !== undefined;
};

// API base URL - use environment variable if available, default to 3010
const API_PORT = process.env.DASHBOARD_PORT || 3010;
const validatedPort = Number.parseInt(API_PORT, 10);
if (Number.isNaN(validatedPort) || validatedPort < 1 || validatedPort > 65535) {
  console.warn(`Invalid API port: ${API_PORT}, defaulting to 3010`);
}
const API_BASE_URL = `http://127.0.0.1:${validatedPort || 3010}`;

// Maximum retry attempts
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Make an HTTP request to the API
 * @param {string} endpoint - API endpoint (e.g., '/api/workspaces')
 * @param {Object} options - Request options
 * @returns {Promise<any>} - Response data
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const retries = options.retries || MAX_RETRIES;
  
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      let response;
      
      if (isTauri()) {
        // Use Tauri HTTP plugin in desktop mode
        // Note: The Tauri HTTP plugin is loaded via the plugin system
        response = await fetch(url, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          body: options.body ? JSON.stringify(options.body) : undefined
        });
      } else {
        // Use native fetch in browser/development mode
        response = await fetch(url, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          body: options.body ? JSON.stringify(options.body) : undefined
        });
      }
      
      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If JSON parsing fails, use the status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
      
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.message && error.message.includes('4')) {
        throw error;
      }
      
      // Wait before retrying
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error(`Failed to fetch ${endpoint} after ${retries} attempts`);
}

/**
 * Get all workspaces
 * @returns {Promise<Array>} - List of workspaces
 */
export async function getWorkspaces() {
  return apiRequest('/api/workspaces');
}

/**
 * Validate a single workspace path
 * @param {string} path - Path to validate
 * @returns {Promise<{path: string, valid: boolean}>} - Validation result
 */
export async function validatePath(path) {
  return apiRequest('/api/validate-path', {
    method: 'POST',
    body: { path }
  });
}

/**
 * Validate multiple workspace paths in batch
 * @param {Array<{id: string, path: string}>} workspaces - Array of workspace objects
 * @returns {Promise<{results: Object}>} - Map of workspace id to validation result
 */
export async function validatePaths(workspaces) {
  return apiRequest('/api/validate-paths', {
    method: 'POST',
    body: { workspaces }
  });
}

/**
 * Delete workspaces from the Path
 * @param {Array<string>} ids - Array of workspace IDs to delete
 * @returns {Promise<{success: boolean, removed: number, message?: string, errors?: Array<string>}>}
 */
export async function deleteWorkspaces(ids) {
  console.log('[API Client] deleteWorkspaces called with IDs:', ids);
  try {
    const result = await apiRequest('/api/workspaces/delete', {
      method: 'POST',
      body: { ids }
    });
    console.log('[API Client] deleteWorkspaces result:', result);
    return result;
  } catch (error) {
    console.error('[API Client] deleteWorkspaces error:', error);
    throw error;
  }
}

/**
 * Check if the API is available (health check)
 * @returns {Promise<boolean>} - True if API is available
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      // Short timeout for health check
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for the API to become available
 * @param {number} timeout - Maximum wait time in milliseconds
 * @param {number} interval - Check interval in milliseconds
 * @returns {Promise<boolean>} - True if API became available
 */
export async function waitForApi(timeout = 30000, interval = 1000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await checkHealth()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  return false;
}

/**
 * Get the current environment type
 * @returns {string} - 'tauri' or 'browser'
 */
export function getEnvironment() {
  return isTauri() ? 'tauri' : 'browser';
}

/**
 * Get diagnostics information for troubleshooting
 * In Tauri mode, calls the Rust backend for sidecar info.
 * In browser mode, returns basic connection diagnostics.
 * @returns {Promise<Object>} - Diagnostics data
 */
export async function getDiagnostics() {
  const diag = {
    environment: getEnvironment(),
    api_url: API_BASE_URL,
    api_port: validatedPort || 3010,
    timestamp: new Date().toISOString(),
  };

  // Check API health
  diag.health_check = await checkHealth();

  // In Tauri mode, call the Rust get_diagnostics command
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const tauriDiag = await invoke('get_diagnostics');
      return { ...diag, ...tauriDiag };
    } catch (e) {
      diag.tauri_error = e.toString();
    }
  }

  return diag;
}

// Default export
export default {
  request: apiRequest,
  getWorkspaces,
  validatePath,
  validatePaths,
  deleteWorkspaces,
  checkHealth,
  waitForApi,
  getEnvironment,
  getDiagnostics
};