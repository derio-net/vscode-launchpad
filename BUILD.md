# Build Instructions

This document provides instructions for building the VS Code Launchpad from source.

## Prerequisites

### All Platforms

- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js
- **Rust**: Latest stable version (for Tauri) - [Installation Guide](#installing-rust)

### Platform-Specific Requirements

#### macOS

1. **Xcode Command Line Tools** (required for compiling native code):
   ```bash
   xcode-select --install
   ```
   If already installed, this will show: `xcode-select: error: command line tools are already installed`

2. **Rust** (required by Tauri) - See [Installing Rust](#installing-rust) below

#### Windows
- Microsoft Visual Studio C++ Build Tools
- Windows SDK

#### Linux
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf

# Fedora
sudo dnf install -y gtk3-devel webkit2gtk4.0-devel libappindicator-gtk3-devel librsvg2-devel patchelf

# Arch
sudo pacman -S gtk3 webkit2gtk libappindicator-gtk3 librsvg patchelf
```

## Installing Rust

Rust is required for building the Tauri desktop application. If you see the error `failed to run 'cargo metadata' command`, Rust is not installed.

### macOS / Linux

```bash
# Install Rust via rustup (the official Rust installer)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Follow the prompts (option 1 - default installation is recommended)

# Reload your shell environment to make cargo available
source $HOME/.cargo/env

# Verify installation
cargo --version
rustc --version
```

### Windows

Download and run the installer from [https://rustup.rs/](https://rustup.rs/)

Or use PowerShell:
```powershell
winget install Rustlang.Rustup
```

Then restart your terminal and verify:
```powershell
cargo --version
rustc --version
```

### Keeping Rust Updated

```bash
rustup update
```

## Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/derio-net/vscode-launchpad.git
   cd vscode-launchpad
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Verify Rust is installed** (required for Tauri desktop builds):
   ```bash
   cargo --version
   ```
   If this command fails, see [Installing Rust](#installing-rust) above.

## Development Mode

### Web-only Development

Run the application in browser mode for frontend development:

```bash
npm run dev
```

This starts the Express server on http://localhost:3010.

### Desktop Development

Run the Tauri desktop application in development mode:

```bash
npm run tauri dev
```

This will:
1. Start the frontend development server
2. Launch the Tauri desktop window
3. Enable hot-reload for both frontend and Rust code

## Building for Production

### Build Sidecar Binary

The sidecar is the Node.js backend bundled as a standalone executable:

```bash
# Install pkg globally if not already installed
npm install -g pkg

# Build for current platform
pkg server/index.js --config pkg.config.json

# Build for specific platform
pkg server/index.js --config pkg.config.json --targets node18-macos-x64
```

Binaries will be output to `src-tauri/binaries/`.

### Build Desktop Application

#### Build for Current Platform

```bash
npm run tauri build
```

This builds the desktop app **for your current OS only**. The built application will be in `src-tauri/target/release/bundle/`.

#### Cross-Platform Builds (CI)

Cross-platform builds for all targets (macOS x64/ARM64, Windows x64, Linux x64) run automatically via GitHub Actions when a version tag is pushed. See [`.github/workflows/release.yml`](.github/workflows/release.yml) for the automated build process.

### Build Outputs

After building, you'll find the following in `src-tauri/target/release/bundle/`:

- **macOS**: `.dmg`, `.app` bundle
- **Windows**: `.msi`, `.exe` installer
- **Linux**: `.AppImage`, `.deb` package

## Project Structure

```
vscode-launchpad/
├── .github/workflows/      # GitHub Actions CI/CD
├── public/                 # Static assets (built frontend)
├── server/                 # Node.js backend
│   ├── index.js           # Express server
│   └── workspaceScanner.js # Workspace scanning logic
├── src/                    # React frontend source
│   ├── api/               # API client
│   ├── components/        # React components
│   └── ...
├── src-tauri/             # Tauri desktop app
│   ├── src/               # Rust source code
│   ├── binaries/          # Sidecar binaries
│   ├── icons/             # App icons
│   └── tauri.conf.json    # Tauri configuration
├── pkg.config.json        # pkg configuration
└── package.json           # Node.js dependencies
```

## Environment Variables

### Development

- `DASHBOARD_PORT`: Backend server port (default: 3010)
- `HOST`: Backend server host (default: 127.0.0.1)
- `WORKSPACES_MOUNT_POINT`: Override workspace storage path
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

### Desktop App

- `SIDECAR_PORT`: Port for the sidecar backend (default: 3010)

## Code Signing

### macOS

1. Obtain an Apple Developer ID certificate
2. Set environment variables:
   ```bash
   export APPLE_CERTIFICATE="$(cat certificate.p12 | base64)"
   export APPLE_CERTIFICATE_PASSWORD="your-password"
   export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name"
   export APPLE_ID="your-apple-id@example.com"
   export APPLE_PASSWORD="app-specific-password"
   export APPLE_TEAM_ID="your-team-id"
   ```
3. Build: `npm run tauri build`

### Windows

1. Obtain a code signing certificate
2. Set environment variables:
   ```bash
   set WINDOWS_CERTIFICATE=base64-encoded-certificate
   set WINDOWS_CERTIFICATE_PASSWORD=your-password
   ```
3. Build: `npm run tauri build`

## Troubleshooting

### Build Failures

#### `failed to run 'cargo metadata' command` / `No such file or directory (os error 2)`
**Cause**: Rust/Cargo is not installed on your system.

**Solution**: Install Rust following the [Installing Rust](#installing-rust) section above, then reload your terminal or run `source $HOME/.cargo/env`.

#### Rust compilation errors
- Ensure Rust is up to date: `rustup update`
- Clean build: `cargo clean` in `src-tauri/`

#### Node.js errors
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear npm cache: `npm cache clean --force`

#### Sidecar build fails
- Ensure `pkg` is installed: `npm install -g pkg`
- Check that `server/index.js` exists and is valid

### Runtime Issues

#### Sidecar not found
- Ensure sidecar binaries are in `src-tauri/binaries/`
- Check that binary names match the pattern in `tauri.conf.json`

#### App crashes on startup
- Check the logs for error messages
- Ensure all dependencies are installed
- Try building in debug mode: `npm run tauri build -- --debug`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test on your platform
5. Submit a pull request

## Release Process

1. Update version in:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`

2. Create a git tag:
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

3. GitHub Actions will automatically:
   - Build sidecar binaries for all platforms
   - Build Tauri applications
   - Create a draft release with artifacts

4. Review and publish the release on GitHub
