# Troubleshooting

Common issues and solutions for VS Code Launchpad.

## Desktop App Issues

### App won't start
- Check that your platform is supported (macOS 10.13+, Windows 10+, Ubuntu 20.04+)
- Try running from terminal to see error messages:
  - **macOS**: `/Applications/VS\ Code\ Launchpad.app/Contents/MacOS/vscode-launchpad`
  - **Windows**: Run the `.exe` from Command Prompt
  - **Linux**: Run the AppImage from terminal

### Backend service failed to start
- The app will show an error dialog if the backend fails to start after 3 attempts
- Try restarting the application
- Check if port 3010 is already in use by another application
- Check the logs in the app data directory for details

### Auto-updater not working
- Pre-built releases are not yet published. Auto-update will be available once releases are being built and published to GitHub Releases.
- Ensure you have an internet connection
- Check that the app is not blocked by a firewall
- Updates require the app to be installed (not running from a portable location)

## No workspaces found

- Verify VS Code is installed and you have opened workspaces before
- Check the workspace storage path exists on your platform:
  - **macOS**: `ls ~/Library/Application\ Support/Code/User/workspaceStorage/`
  - **Windows**: Check `%APPDATA%\Code\User\workspaceStorage\`
  - **Linux**: `ls ~/.config/Code/User/workspaceStorage/`
- Check the server logs for any error messages
- You can override the path using the `WORKSPACES_MOUNT_POINT` environment variable

## Server won't start

- Ensure port 3010 is not already in use
- Try a different port: `DASHBOARD_PORT=8080 npm start`
- Check Node.js is installed: `node --version`

## Docker issues

### Docker image build fails
- Ensure Docker is installed and running: `docker --version`
- Check available disk space for the image
- Try rebuilding without cache: `docker-compose build --no-cache`

### Container won't start
- Check the logs: `docker-compose logs`
- Ensure the `WORKSPACES_MOUNT_POINT` in `.env` is correct and accessible
- Verify the path exists on your system: `ls -la /path/to/workspaces`

### Permission denied errors
- The container runs as the `node` user
- Ensure the workspace directory is readable by the container
- Try adjusting directory permissions: `chmod 755 /path/to/workspaces`

### Port already in use
- Change the `DASHBOARD_PORT` in `.env` to an available port
- Or stop other services using port 3010: `lsof -i :3010`

## Clicking workspace names doesn't open VS Code

- Verify VS Code is installed on your system
- Check that the `code` command is available in your PATH (run `which code` in terminal)
- Your browser may require permission to open the `vscode://` protocol - click "Allow" when prompted
- Try opening VS Code manually first, then try clicking a workspace name again
- On macOS, you may need to register the VS Code protocol handler by running:
  ```bash
  /Applications/Visual\ Studio\ Code.app/Contents/Resources/app/bin/code --install-code-handler
  ```

## Remote workspaces (SSH, Dev Containers) don't open

- Remote workspaces require VS Code to have the appropriate remote extension installed:
  - **SSH Remote**: Install the "Remote - SSH" extension
  - **Dev Containers**: Install the "Dev Containers" extension
  - **Attached Containers**: Install the "Dev Containers" extension
- The browser console may show "scheme does not have a registered handler" - this is expected if the remote extension isn't installed
- Install the required extension in VS Code, then try clicking the remote workspace link again
- The dashboard will attempt to open the workspace in a new window if the initial attempt fails

## Tooltip not showing

- The tooltip uses the browser's native `title` attribute
- Hover over the workspace name and wait a moment for the tooltip to appear
- The tooltip appearance depends on your operating system and browser
- On some systems, you may need to hover for a second or two before it appears

## Browser security warning

- When you click a workspace name for the first time, your browser may show a security prompt
- This is normal - click "Allow" or "Open" to permit the `vscode://` protocol handler
- You can usually check "Remember this choice" to avoid the prompt in the future
