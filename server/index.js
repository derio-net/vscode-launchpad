const express = require('express');
const path = require('path');
const workspaceScanner = require('./workspaceScanner');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3010;
const DEV_PORT = process.env.DASHBOARD_DEV_PORT || 3020;
const HOST = process.env.HOST || '127.0.0.1'; // Localhost by default, 0.0.0.0 in Docker
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Configure logging based on LOG_LEVEL
const log = {
  debug: (...args) => LOG_LEVEL === 'debug' && console.log('[DEBUG]', ...args),
  info: (...args) => ['debug', 'info'].includes(LOG_LEVEL) && console.log('[INFO]', ...args),
  warn: (...args) => ['debug', 'info', 'warn'].includes(LOG_LEVEL) && console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

// Middleware
app.use(express.json());

// CORS configuration for Tauri webview and development
app.use((req, res, next) => {
  // Allow requests from Tauri webview and configured ports
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
    // For security, block unknown origins
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

// Request logging middleware - log ALL requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('[Server] Health check endpoint called');
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes - MUST be defined BEFORE static file serving
// to prevent the catch-all route from intercepting API requests

app.get('/api/workspaces', async (req, res) => {
  try {
    // Always fetch fresh workspaces instead of using cache
    // This ensures we get the latest state after deletions
    const workspaces = await workspaceScanner.scanWorkspaces();
    res.json(workspaces);
  } catch (error) {
    log.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces', details: error.message });
  }
});

// Validate a single path
app.post('/api/validate-path', async (req, res) => {
  try {
    const { path: workspacePath } = req.body;
    
    if (!workspacePath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const isValid = await workspaceScanner.validatePath(workspacePath);
    res.json({ path: workspacePath, valid: isValid });
  } catch (error) {
    log.error('Error validating path:', error);
    res.status(500).json({ error: 'Failed to validate path' });
  }
});

// Validate multiple paths in batch
app.post('/api/validate-paths', async (req, res) => {
  try {
    const { workspaces } = req.body;
    
    if (!Array.isArray(workspaces)) {
      return res.status(400).json({ error: 'Workspaces array is required' });
    }
    
    const results = await workspaceScanner.validatePaths(workspaces);
    res.json({ results });
  } catch (error) {
    log.error('Error validating paths:', error);
    res.status(500).json({ error: 'Failed to validate paths' });
  }
});

// Delete workspaces
app.post('/api/workspaces/delete', async (req, res) => {
  console.log('[Server] Delete endpoint called');
  console.log('[Server] Request body:', req.body);
  
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      console.log('[Server] Validation failed: IDs array is required');
      return res.status(400).json({ error: 'Workspace IDs array is required' });
    }
    
    console.log('[Server] Calling removeWorkspacesFromPath with IDs:', ids);
    const result = await workspaceScanner.removeWorkspacesFromPath(ids);
    console.log('[Server] removeWorkspacesFromPath result:', result);
    
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
    log.error('Error deleting workspaces:', error);
    res.status(500).json({ error: 'Failed to delete workspaces' });
  }
});

// Serve static files from the public directory - AFTER API routes
app.use(express.static(path.join(__dirname, '../public')));

// Serve React app for all other routes - MUST be last
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize workspace scanner and start server
workspaceScanner.initialize().then(() => {
  app.listen(PORT, HOST, () => {
    // Always log startup info regardless of LOG_LEVEL
    console.log('========================================');
    console.log(`🚀 VS Code Launchpad running at http://${HOST}:${PORT}`);
    console.log('========================================');
    console.log(`📡 API Endpoints available:`);
    console.log(`   - GET  /health`);
    console.log(`   - GET  /api/workspaces`);
    console.log(`   - POST /api/validate-path`);
    console.log(`   - POST /api/validate-paths`);
    console.log(`   - POST /api/workspaces/delete`);
    console.log('========================================');
    console.log('🔒 Server is only accessible from localhost for security');
    console.log('========================================');
    
    log.info(`VS Code Launchpad running at http://${HOST}:${PORT}`);
    log.info('Server is only accessible from localhost for security');
  });
}).catch(error => {
  log.error('Failed to initialize workspace scanner:', error);
  process.exit(1);
});
