# VS Code Workspace Dashboard

A simple web dashboard to view and manage your VS Code workspaces. This tool reads workspace metadata from VS Code's storage directory and presents it in an easy-to-use interface.

## Features

- 📁 **View All Workspaces**: See all your VS Code workspaces in one place
- 🔍 **Search & Filter**: Search by name or path, filter by workspace type
- 📊 **Sort**: Sort by name, path, type, or last modified date
- 🔄 **Auto-Refresh**: Automatically detects new workspaces every 30 seconds
- 🎨 **Clean UI**: Modern, responsive interface that works on all screen sizes
- 🔒 **Secure**: Runs only on localhost (127.0.0.1) for security (or network-accessible in Docker)
- 🚀 **Quick Open**: Click on any workspace name to open it directly in VS Code
- 💡 **Path Tooltips**: Hover over workspace names to see the full file path
- 🐳 **Docker Support**: Deploy easily with Docker and docker-compose

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

### Option 1: Local Development

#### Start the Dashboard

```bash
npm start
```

This will:
1. Build the React frontend
2. Start the Express server on http://localhost:3010
3. Open your browser to view the dashboard

### Option 2: Docker Deployment

#### Prerequisites
- Docker and docker-compose installed

#### Quick Start

1. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your workspace path:
   ```bash
   # Edit .env and set WORKSPACES_PATH to your VS Code workspace storage directory
   # Example for macOS:
   WORKSPACES_PATH=/Users/username/Library/Application\ Support/Code/User/workspaceStorage
   ```

3. Start the application:
   ```bash
   docker-compose up -d
   ```

4. Access the dashboard at http://localhost:3010

#### Docker Commands

- **View logs**: `docker-compose logs -f`
- **Stop the application**: `docker-compose down`
- **Rebuild the image**: `docker-compose build --no-cache`
- **Change port**: Set `PORT=8080` in `.env` before running `docker-compose up`

#### Configuration

The following environment variables can be set in `.env`:

- `PORT`: Port to expose the application on (default: 3010)
- `WORKSPACES_PATH`: Path to VS Code workspaces directory on the host (required for Docker)

#### Volume Mounting

The Docker container mounts your VS Code workspaces directory as read-only. This allows the dashboard to access your workspaces without modifying them.

**Important**: Ensure the `WORKSPACES_PATH` in `.env` points to the correct directory on your system.

### Opening Workspaces

Click on any workspace name in the dashboard to open it directly in VS Code:
- If the workspace is already open, VS Code will focus that window
- If the workspace is not open, a new VS Code window will open with that workspace
- Your browser may show a security prompt the first time - click "Allow" to proceed

**Note**: VS Code must be installed for this feature to work.

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

### Local Development
The server is configured to only listen on `127.0.0.1` (localhost) and is not accessible from external networks. This ensures your workspace data remains private and secure.

### Docker Deployment
When running in Docker, the application listens on `0.0.0.0` to accept connections from any network interface. **Important**: Only deploy Docker containers in trusted networks. Consider the following security measures:

- Run docker-compose only on trusted networks
- Use a firewall to restrict access to the container port
- Consider adding authentication/authorization in future versions
- The volume mount is read-only to prevent accidental modifications

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

### Docker issues

#### Docker image build fails
- Ensure Docker is installed and running: `docker --version`
- Check available disk space for the image
- Try rebuilding without cache: `docker-compose build --no-cache`

#### Container won't start
- Check the logs: `docker-compose logs`
- Ensure the `WORKSPACES_PATH` in `.env` is correct and accessible
- Verify the path exists on your system: `ls -la /path/to/workspaces`

#### Permission denied errors
- The container runs as the `node` user
- Ensure the workspace directory is readable by the container
- Try adjusting directory permissions: `chmod 755 /path/to/workspaces`

#### Port already in use
- Change the `PORT` in `.env` to an available port
- Or stop other services using port 3000: `lsof -i :3000`

### Clicking workspace names doesn't open VS Code

- Verify VS Code is installed on your system
- Check that the `code` command is available in your PATH (run `which code` in terminal)
- Your browser may require permission to open the `vscode://` protocol - click "Allow" when prompted
- Try opening VS Code manually first, then try clicking a workspace name again
- On macOS, you may need to register the VS Code protocol handler by running:
  ```bash
  /Applications/Visual\ Studio\ Code.app/Contents/Resources/app/bin/code --install-code-handler
  ```

### Remote workspaces (SSH, Dev Containers) don't open

- Remote workspaces require VS Code to have the appropriate remote extension installed:
  - **SSH Remote**: Install the "Remote - SSH" extension
  - **Dev Containers**: Install the "Dev Containers" extension
  - **Attached Containers**: Install the "Dev Containers" extension
- The browser console may show "scheme does not have a registered handler" - this is expected if the remote extension isn't installed
- Install the required extension in VS Code, then try clicking the remote workspace link again
- The dashboard will attempt to open the workspace in a new window if the initial attempt fails

### Tooltip not showing

- The tooltip uses the browser's native `title` attribute
- Hover over the workspace name and wait a moment for the tooltip to appear
- The tooltip appearance depends on your operating system and browser
- On some systems, you may need to hover for a second or two before it appears

### Browser security warning

- When you click a workspace name for the first time, your browser may show a security prompt
- This is normal - click "Allow" or "Open" to permit the `vscode://` protocol handler
- You can usually check "Remember this choice" to avoid the prompt in the future

## Requirements

- Node.js 14 or higher
- macOS (for the default workspace storage path)
- VS Code installed with at least one workspace opened

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
