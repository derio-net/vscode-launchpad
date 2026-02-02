# VS Code Workspace Dashboard

A simple web dashboard to view and manage your VS Code workspaces. This tool reads workspace metadata from VS Code's storage directory and presents it in an easy-to-use interface.

## Features

- 📁 **View All Workspaces**: See all your VS Code workspaces in one place
- 🔍 **Search & Filter**: Search by name or path, filter by workspace type
- 📊 **Sort**: Sort by name, path, type, or last modified date
- 🔄 **Auto-Refresh**: Automatically detects new workspaces every 30 seconds
- 🎨 **Clean UI**: Modern, responsive interface that works on all screen sizes
- 🔒 **Secure**: Runs only on localhost (127.0.0.1) for security

## Supported Workspace Types

- **Local**: Regular local folders and workspace files
- **Remote**: VS Code remote workspaces
- **Dev Container**: Development containers
- **Attached Container**: Attached containers
- **SSH Remote**: SSH remote workspaces

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Start the Dashboard

```bash
npm start
```

This will:
1. Build the React frontend
2. Start the Express server on http://localhost:3000
3. Open your browser to view the dashboard

### Development Mode

For development without rebuilding:

```bash
npm run build  # Build once
npm run dev    # Start server only
```

## How It Works

The dashboard reads workspace metadata from:
```
~/Library/Application Support/Code/User/workspaceStorage/
```

Each workspace directory contains a `workspace.json` file with information about the workspace location and type. The dashboard:

1. Scans all workspace directories on startup
2. Parses the JSON files to extract metadata
3. Caches the data in memory
4. Refreshes the cache every 30 seconds
5. Serves the data via a REST API
6. Displays it in a React-based web interface

## API Endpoints

### GET /api/workspaces

Returns an array of all discovered workspaces:

```json
[
  {
    "id": "workspace-id",
    "name": "My Project",
    "path": "file:///Users/username/projects/my-project",
    "type": "local",
    "lastModified": "2024-01-15T10:30:00.000Z",
    "storageDir": "/path/to/storage/dir"
  }
]
```

## Configuration

### Port

Change the port by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

### Refresh Interval

Edit `server/workspaceScanner.js` and change the `REFRESH_INTERVAL` constant (in milliseconds):

```javascript
const REFRESH_INTERVAL = 30000; // 30 seconds
```

## Security

The server is configured to only listen on `127.0.0.1` (localhost) and is not accessible from external networks. This ensures your workspace data remains private and secure.

## Troubleshooting

### No workspaces found

- Verify VS Code is installed and you have opened workspaces before
- Check the workspace storage path exists:
  ```bash
  ls ~/Library/Application\ Support/Code/User/workspaceStorage/
  ```
- Check the server logs for any error messages

### Server won't start

- Ensure port 3000 is not already in use
- Try a different port: `PORT=8080 npm start`
- Check Node.js is installed: `node --version`

## Requirements

- Node.js 14 or higher
- macOS (for the default workspace storage path)
- VS Code installed with at least one workspace opened

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
