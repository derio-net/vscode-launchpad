const express = require('express');
const path = require('path');
const workspaceScanner = require('./workspaceScanner');

const app = express();
const PORT = process.env.PORT || 3010;
const HOST = process.env.HOST || '127.0.0.1'; // Localhost by default, 0.0.0.0 in Docker

// Middleware
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.get('/api/workspaces', (req, res) => {
  try {
    const workspaces = workspaceScanner.getWorkspaces();
    res.json(workspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize workspace scanner and start server
workspaceScanner.initialize().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`VS Code Workspace Dashboard running at http://${HOST}:${PORT}`);
    console.log('Server is only accessible from localhost for security');
  });
}).catch(error => {
  console.error('Failed to initialize workspace scanner:', error);
  process.exit(1);
});
