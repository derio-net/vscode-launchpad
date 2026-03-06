# VS Code Workspace Dashboard

[![Tests](https://github.com/derio-net/vs_code_workspace_dashboard/actions/workflows/test.yml/badge.svg)](https://github.com/derio-net/vs_code_workspace_dashboard/actions/workflows/test.yml)
[![Frontend Tests](https://img.shields.io/badge/frontend%20tests-39%20passing-brightgreen)](src/__tests__)
[![Server Tests](https://img.shields.io/badge/server%20tests-29%20passing-brightgreen)](server/__tests__)
[![E2E Tests](https://img.shields.io/badge/e2e%20tests-45%20passing-brightgreen)](e2e)
[![Playwright](https://img.shields.io/badge/tested%20with-Playwright-45ba4b.svg?logo=playwright)](https://playwright.dev)

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
- 💻 **Desktop App**: Native desktop application using Tauri (macOS, Windows, Linux)

## Supported Workspace Types

- **Local**: Regular local folders and workspace files
- **Remote**: VS Code remote workspaces
- **Dev Container**: Development containers
- **Attached Container**: Attached containers
- **SSH Remote**: SSH remote workspaces

## Installation

### Option 1: Desktop Application (Recommended)

Download the latest release for your platform from the [Releases](https://github.com/derio-net/vs_code_workspace_dashboard/releases) page:

- **macOS**: Download `.dmg` or `.app` bundle
- **Windows**: Download `.msi` installer or `.exe`
- **Linux**: Download `.AppImage` or `.deb` package

The desktop app includes everything you need - no Node.js or dependencies required!

### Option 2: Local Development

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Desktop Application

Simply launch the application:
- **macOS**: Open the `.app` bundle or install from `.dmg`
- **Windows**: Run the installer or portable `.exe`
- **Linux**: Run the `.AppImage` or install the `.deb` package

The desktop app will automatically:
- Start the backend service
- Open the dashboard window
- Monitor the service health and restart if needed

### Local Development

#### Start the Dashboard

```bash
npm start
```

This will:
1. Build the React frontend
2. Start the Express server on http://localhost:3010
3. Open your browser to view the dashboard

### Docker Deployment

#### Prerequisites
- Docker and docker-compose installed

#### Quick Start

1. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your workspace path:
   ```bash
   # Edit .env and set WORKSPACES_MOUNT_POINT to your VS Code workspace storage directory
   # Example for macOS:
   WORKSPACES_MOUNT_POINT=/Users/username/Library/Application\ Support/Code/User/workspaceStorage
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
- `WORKSPACES_MOUNT_POINT`: Path to VS Code workspaces directory on the host (required for Docker)

#### Volume Mounting

The Docker container mounts your VS Code workspaces directory as read-only. This allows the dashboard to access your workspaces without modifying them.

**Important**: Ensure the `WORKSPACES_MOUNT_POINT` in `.env` points to the correct directory on your system.

### Opening Workspaces

Click on any workspace name in the dashboard to open it directly in VS Code:
- If the workspace is already open, VS Code will focus that window
- If the workspace is not open, a new VS Code window will open with that workspace
- Your browser may show a security prompt the first time - click "Allow" to proceed

### Desktop App Features

The desktop application provides:
- **Native Window**: Dedicated app window with native controls
- **System Tray**: Optional tray icon for quick access
- **Auto-Update**: Automatic update checks and installation
- **Window State**: Remembers window size and position
- **Menu Bar**: Standard application menu (File, Edit, View, etc.)
- **Health Monitoring**: Automatically restarts backend if it crashes
- **Cross-Platform**: Works on macOS, Windows, and Linux

**Note**: VS Code must be installed for this feature to work.

### Development Mode

For development without rebuilding:

```bash
npm run build  # Build once
npm run dev    # Start server only
```

## How It Works

The dashboard reads workspace metadata from platform-specific locations:

- **macOS**: `~/Library/Application Support/Code/User/workspaceStorage/`
- **Windows**: `%APPDATA%\Code\User\workspaceStorage\`
- **Linux**: `~/.config/Code/User/workspaceStorage/` (or `$XDG_CONFIG_HOME` if set)

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

## Testing

The project has comprehensive automated test coverage across three layers:

### Running Tests

```bash
# Run all frontend unit tests (once)
npm test

# Run frontend tests in watch mode
npm run test:watch

# Run frontend tests with coverage report
npm run test:coverage

# Run server/API tests
npm run test:server

# Run server tests in watch mode
npm run test:server:watch

# Run all tests (frontend + server)
npm run test:all

# Run E2E tests (requires running dev server)
npm run test:e2e

# Run E2E tests with interactive UI
npm run test:e2e:ui
```

### Test Structure

```
src/
  __tests__/
    App.test.jsx              # App component tests (loading, error states)
    components/
      Dashboard.test.jsx      # Dashboard component tests
      WorkspaceTable.test.jsx # WorkspaceTable component tests
  utils/
    workspaceUtils.test.js    # Utility function tests (URI parsing)
  __mocks__/
    @tauri-apps/              # Tauri API mocks for testing

server/
  __tests__/
    api.test.js               # API endpoint tests (supertest)
    workspaceScanner.test.js  # Workspace scanner integration tests

e2e/
  dashboard.spec.js           # Dashboard page E2E tests
  workspace-opening.spec.js   # Workspace opening E2E tests
  column-visibility.spec.js   # Column visibility E2E tests
  dark-theme.spec.js          # Dark theme E2E tests
```

### Test Naming Conventions

- **Unit tests**: `*.test.js` or `*.test.jsx` - placed next to source files or in `__tests__/`
- **E2E tests**: `*.spec.js` - placed in `e2e/` directory
- **Test descriptions**: Use `describe` blocks with `Spec: <requirement name>` format
- **Test cases**: Use `it('should...')` or `it('does...')` format

### E2E Test Prerequisites

E2E tests require a running development server:

```bash
# Terminal 1: Start the backend
npm run dev:server

# Terminal 2: Start the frontend
npm run dev:react

# Terminal 3: Run E2E tests
npm run test:e2e
```

Or configure the `webServer` option in [`playwright.config.js`](playwright.config.js) to auto-start.

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

### Desktop App Issues

#### App won't start
- Check that your platform is supported (macOS 10.13+, Windows 10+, Ubuntu 20.04+)
- Try running from terminal to see error messages:
  - **macOS**: `/Applications/VS\ Code\ Workspace\ Dashboard.app/Contents/MacOS/vscode-workspace-dashboard`
  - **Windows**: Run the `.exe` from Command Prompt
  - **Linux**: Run the AppImage from terminal

#### Backend service failed to start
- The app will show an error dialog if the backend fails to start after 3 attempts
- Try restarting the application
- Check if port 3010 is already in use by another application
- Check the logs in the app data directory for details

#### Auto-updater not working
- Ensure you have an internet connection
- Check that the app is not blocked by a firewall
- Updates require the app to be installed (not running from a portable location)

### No workspaces found

- Verify VS Code is installed and you have opened workspaces before
- Check the workspace storage path exists on your platform:
  - **macOS**: `ls ~/Library/Application\ Support/Code/User/workspaceStorage/`
  - **Windows**: Check `%APPDATA%\Code\User\workspaceStorage\`
  - **Linux**: `ls ~/.config/Code/User/workspaceStorage/`
- Check the server logs for any error messages
- You can override the path using the `WORKSPACES_MOUNT_POINT` environment variable

### Server won't start

- Ensure port 3010 is not already in use
- Try a different port: `PORT=8080 npm start`
- Check Node.js is installed: `node --version`

### Docker issues

#### Docker image build fails
- Ensure Docker is installed and running: `docker --version`
- Check available disk space for the image
- Try rebuilding without cache: `docker-compose build --no-cache`

#### Container won't start
- Check the logs: `docker-compose logs`
- Ensure the `WORKSPACES_MOUNT_POINT` in `.env` is correct and accessible
- Verify the path exists on your system: `ls -la /path/to/workspaces`

#### Permission denied errors
- The container runs as the `node` user
- Ensure the workspace directory is readable by the container
- Try adjusting directory permissions: `chmod 755 /path/to/workspaces`

#### Port already in use
- Change the `PORT` in `.env` to an available port
- Or stop other services using port 3010: `lsof -i :3010`

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
