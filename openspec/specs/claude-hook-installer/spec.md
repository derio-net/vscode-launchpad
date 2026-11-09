# claude-hook-installer Specification

## Purpose
TBD - created by archiving change bundled-claude-hook. Update Purpose after archive.
## Requirements
### Requirement: Hook script is bundled with the server
The system SHALL embed the Claude Code hook script in the server code so that every distribution (desktop sidecar, web server, Docker image) carries it, with no dependency on a repository checkout.

#### Scenario: Desktop app without a checkout
- **WHEN** the desktop app is installed from a release and no repository clone exists on the machine
- **THEN** the user SHALL be able to install the hook from the app

#### Scenario: Hook written to a stable location
- **WHEN** the hook is installed
- **THEN** the script SHALL be written to `~/.claude/vscode-launchpad/hook.sh` with executable permissions
- **AND** the hook commands in `~/.claude/settings.json` SHALL reference that path, not the app or repository location

### Requirement: Hook script runs without extra dependencies and never fails a Claude turn
The hook script SHALL run under a POSIX `sh` without `jq` or other non-standard tools, and SHALL always exit with status 0.

#### Scenario: Working state written
- **WHEN** the hook runs with argument `working` and stdin JSON containing `"session_id":"abc-123"`
- **THEN** `~/.claude/vscode-launchpad/state/abc-123.json` SHALL contain `"type":"working"` and a numeric `ts`

#### Scenario: Notification type mapped
- **WHEN** the hook runs without an argument and stdin JSON contains `"notification_type":"permission_prompt"`
- **THEN** the state type SHALL be `waiting`
- **AND** `idle_prompt` SHALL map to `idle`

#### Scenario: Unsafe or missing session id
- **WHEN** stdin JSON has no `session_id`, or its value contains characters outside `A-Z a-z 0-9 _ -`
- **THEN** the hook SHALL write no file and exit 0

#### Scenario: Unwritable state directory
- **WHEN** the state directory cannot be created or written
- **THEN** the hook SHALL exit 0 without printing an error that Claude Code would surface

### Requirement: Report hook installation status
The system SHALL report the hook installation status as exactly one of `installed`, `needs-repair`, `not-installed`, or `unsupported`.

#### Scenario: Installed
- **WHEN** Notification, UserPromptSubmit and Stop each have a current LaunchPad hook entry, the hook script exists, and no legacy entries remain
- **THEN** the status SHALL be `installed`

#### Scenario: Legacy checkout-based entries
- **WHEN** any hook command contains `claude-session-hook.sh`
- **THEN** the status SHALL be `needs-repair` with `legacy: true`

#### Scenario: Hook script missing
- **WHEN** current LaunchPad entries exist for all three events but `~/.claude/vscode-launchpad/hook.sh` does not exist
- **THEN** the status SHALL be `needs-repair`

#### Scenario: Partial install
- **WHEN** LaunchPad entries exist for some but not all three events
- **THEN** the status SHALL be `needs-repair`

#### Scenario: Not installed
- **WHEN** no hook command contains a LaunchPad marker, or `settings.json` does not exist
- **THEN** the status SHALL be `not-installed`

#### Scenario: Unsupported environment
- **WHEN** the server runs on Windows or inside a container
- **THEN** the status SHALL be `unsupported` with a human-readable `reason`

### Requirement: Install and repair hooks
The system SHALL install the hooks by removing every existing LaunchPad entry (current or legacy, from any path) and adding one canonical entry per event, preserving all other settings and hooks.

#### Scenario: Fresh install
- **WHEN** install runs with status `not-installed`
- **THEN** the hook script SHALL be written
- **AND** `settings.json` SHALL gain one LaunchPad entry each for Notification (matcher `permission_prompt|idle_prompt`), UserPromptSubmit (`working`) and Stop (`idle`)
- **AND** the status SHALL become `installed`

#### Scenario: Repair after the checkout moved
- **WHEN** `settings.json` contains legacy entries pointing at `/old/checkout/scripts/claude-session-hook.sh`
- **THEN** install SHALL remove them and add the canonical entries
- **AND** no command SHALL reference `/old/checkout`

#### Scenario: Unrelated hooks preserved
- **WHEN** `settings.json` contains other hooks and top-level settings
- **THEN** install and remove SHALL leave them unchanged

#### Scenario: Idempotent
- **WHEN** install runs with status `installed`
- **THEN** `settings.json` SHALL be unchanged

#### Scenario: Backup before modifying
- **WHEN** install or remove changes `settings.json`
- **THEN** the previous content SHALL first be copied to `~/.claude/settings.json.launchpad.bak`
- **AND** the new content SHALL be written atomically (temp file + rename)
- **AND** the backup and the new file SHALL keep the original file's permissions (`0600` for a new file), and SHALL NOT follow a symlink at the backup or temp path

#### Scenario: Invalid settings file
- **WHEN** `settings.json` exists but is not valid JSON
- **THEN** install and remove SHALL fail with an error and SHALL NOT modify the file

### Requirement: Remove hooks
The system SHALL remove only LaunchPad hook entries (current and legacy) and the `~/.claude/vscode-launchpad/` directory.

#### Scenario: Remove installed hooks
- **WHEN** remove runs
- **THEN** all LaunchPad entries SHALL be removed, event arrays left empty SHALL be deleted, and an empty `hooks` object SHALL be deleted
- **AND** the status SHALL become `not-installed`

### Requirement: Refresh the hook script on startup
The system SHALL keep an installed hook script in sync with the bundled version without changing `settings.json`.

#### Scenario: Script outdated after app update
- **WHEN** the server starts, LaunchPad hook entries exist, and the on-disk script differs from the bundled script
- **THEN** the on-disk script SHALL be overwritten with the bundled script

#### Scenario: Hooks not enabled
- **WHEN** the server starts with status `not-installed`
- **THEN** the system SHALL NOT write the script or modify `settings.json`

### Requirement: Hook management API
The system SHALL expose hook status and management over REST.

#### Scenario: Get status
- **WHEN** a GET request is made to `/api/claude-hooks`
- **THEN** the response SHALL include `status`, `scriptPath`, `legacy`, and per-event booleans

#### Scenario: Install via API
- **WHEN** a POST request with `Content-Type: application/json` is made to `/api/claude-hooks/install`
- **THEN** the hooks SHALL be installed and the response SHALL include the new `status`

#### Scenario: Remove via API
- **WHEN** a POST request with `Content-Type: application/json` is made to `/api/claude-hooks/remove`
- **THEN** the hooks SHALL be removed and the response SHALL include the new `status`

#### Scenario: Non-JSON request refused
- **WHEN** a POST to either endpoint has a `Content-Type` other than `application/json`
- **THEN** the server SHALL respond `415` and SHALL NOT modify any file

#### Scenario: Non-loopback Host refused (DNS rebinding)
- **WHEN** a POST to either endpoint has a `Host` header other than `localhost`, `127.0.0.1`, `[::1]` or `tauri.localhost` (any port)
- **THEN** the server SHALL respond `403` and SHALL NOT modify any file

#### Scenario: Untrusted Origin refused
- **WHEN** a POST to either endpoint carries an `Origin` header that is not in the server's CORS allowlist
- **THEN** the server SHALL respond `403` and SHALL NOT modify any file

#### Scenario: Unsupported environment
- **WHEN** a POST to either endpoint is made while status is `unsupported`
- **THEN** the server SHALL respond `409` with the reason and SHALL NOT modify any file

### Requirement: Command-line installer
The system SHALL provide a command-line entry point that uses the same installer implementation.

#### Scenario: CLI from a checkout
- **WHEN** a user runs `scripts/install-claude-hooks.sh`, `--check` or `--remove`
- **THEN** it SHALL perform install, status, or remove through the server installer
- **AND** `--check` SHALL exit 0 only when the status is `installed`

