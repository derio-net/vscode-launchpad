# Docker Deployment

Deploy VS Code Launchpad with Docker for easy, consistent deployments.

## Prerequisites

- Docker and docker-compose installed

## Quick Start

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

## Docker Commands

- **View logs**: `docker-compose logs -f`
- **Stop the application**: `docker-compose down`
- **Rebuild the image**: `docker-compose build --no-cache`
- **Change port**: Set `DASHBOARD_PORT=8080` in `.env` before running `docker-compose up`

## Configuration

The following environment variables can be set in `.env`:

| Variable | Default | Description |
|---|---|---|
| `DASHBOARD_PORT` | `3010` | Port to expose the application on |
| `WORKSPACES_MOUNT_POINT` | (required) | Path to VS Code workspaces directory on the host |

## Volume Mounting

The Docker container mounts your VS Code workspaces directory as read-only. This allows the dashboard to access your workspaces without modifying them.

**Important**: Ensure the `WORKSPACES_MOUNT_POINT` in `.env` points to the correct directory on your system.

## Security

When running in Docker, the application listens on `0.0.0.0` to accept connections from any network interface.

**Important**: Only deploy Docker containers in trusted networks. Consider the following security measures:

- Run docker-compose only on trusted networks
- Use a firewall to restrict access to the container port
- Consider adding authentication/authorization in future versions
- The volume mount is read-only to prevent accidental modifications

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for Docker-specific issues including:
- Docker image build failures
- Container startup problems
- Permission denied errors
- Port conflicts
