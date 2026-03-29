## ADDED Requirements

### Requirement: Discover Claude Code sessions from filesystem
The system SHALL discover active Claude Code sessions by reading JSON files from the `~/.claude/sessions/` directory.

#### Scenario: Session files are read on poll
- **WHEN** the session scanner runs a scan cycle
- **THEN** all `*.json` files in `~/.claude/sessions/` SHALL be read and parsed
- **AND** each file SHALL be expected to contain `pid`, `sessionId`, `cwd`, `startedAt`, `kind`, and `entrypoint` fields

#### Scenario: Malformed session files are skipped
- **WHEN** a session file contains invalid JSON or missing required fields
- **THEN** the file SHALL be skipped with a warning logged
- **AND** other session files SHALL continue to be processed

#### Scenario: Sessions directory does not exist
- **WHEN** `~/.claude/sessions/` does not exist or is not readable
- **THEN** the scanner SHALL return an empty session list

### Requirement: Validate session liveness by PID
The system SHALL verify that each discovered session's process is still running before reporting it.

#### Scenario: Living process on Unix
- **WHEN** a session file with a PID is found
- **THEN** the system SHALL check liveness using `kill -0 <pid>` (signal 0)
- **AND** if the signal succeeds, the session is considered alive

#### Scenario: Dead process is filtered out
- **WHEN** a session file references a PID that is no longer running
- **THEN** the session SHALL NOT be included in scan results

### Requirement: Determine session state from hook state files
The system SHALL read session state from `/tmp/claude-session-state-<sessionId>.json` files written by Claude Code hooks.

#### Scenario: State file exists with "working" type
- **WHEN** a state file contains `{"type": "working", ...}`
- **THEN** the session state SHALL be `"working"`

#### Scenario: State file exists with "waiting" type
- **WHEN** a state file contains `{"type": "waiting", ...}`
- **THEN** the session state SHALL be `"waiting"`

#### Scenario: State file exists with "idle" type
- **WHEN** a state file contains `{"type": "idle", ...}`
- **THEN** the session state SHALL be `"idle"`

#### Scenario: State file does not exist
- **WHEN** no state file exists for a session
- **THEN** the session state SHALL be `"idle"` (default — no hook event fired yet)

### Requirement: Detect zombie sessions
The system SHALL detect orphaned sessions whose terminal or parent process is no longer connected.

#### Scenario: CLI session in tmux with no attached client
- **WHEN** a CLI session's parent tmux server has zero attached clients
- **THEN** the session state SHALL be `"zombie"` regardless of hook state

#### Scenario: CLI session in regular terminal with dead parent
- **WHEN** a CLI session's grandparent process is PID 1 (launchd/init)
- **THEN** the session state SHALL be `"zombie"`

#### Scenario: VS Code extension session with dead parent
- **WHEN** a `claude-vscode` session's parent process is PID 1
- **THEN** the session state SHALL be `"zombie"`

#### Scenario: Zombie state overrides hook state
- **WHEN** a session is detected as zombie
- **THEN** the zombie state SHALL take precedence over any hook-reported state

### Requirement: Gate feature on hook configuration
The system SHALL check that Claude Code hooks are configured before enabling the feature.

#### Scenario: Hooks are configured
- **WHEN** `~/.claude/settings.json` contains the required Notification, UserPromptSubmit, and Stop hooks
- **THEN** `hookConfigured` SHALL be `true` in the API response

#### Scenario: Hooks are not configured
- **WHEN** the required hooks are missing from `~/.claude/settings.json`
- **THEN** `hookConfigured` SHALL be `false` in the API response
- **AND** the sessions array SHALL be empty

### Requirement: Expose sessions via REST API
The system SHALL provide a REST API endpoint that returns sessions with hook configuration status.

#### Scenario: API returns sessions with hook status
- **WHEN** a GET request is made to `/api/claude-sessions`
- **THEN** the response SHALL include `hookConfigured` (boolean) and `sessions` (array)

#### Scenario: API returns empty when hooks not configured
- **WHEN** hooks are not configured
- **THEN** the endpoint SHALL return `{ hookConfigured: false, sessions: [] }`

### Requirement: Kill zombie sessions via API
The system SHALL provide an endpoint to terminate zombie Claude sessions.

#### Scenario: Kill valid claude processes
- **WHEN** a POST request to `/api/claude-sessions/kill` includes `{ pids: [123] }`
- **AND** PID 123 is a running `claude` process
- **THEN** the system SHALL send SIGTERM to PID 123
- **AND** return `{ killed: [123], failed: [] }`

#### Scenario: Refuse to kill non-claude processes
- **WHEN** a POST request includes a PID that is not a `claude` process
- **THEN** the system SHALL NOT send any signal to that PID
- **AND** return it in the `failed` array with a reason

### Requirement: Periodic session scanning
The system SHALL poll for session changes at a configurable interval (default 5 seconds via `CLAUDE_SCAN_INTERVAL` env var).

#### Scenario: Scanner completes within time budget
- **WHEN** the scanner runs
- **THEN** it SHALL complete within 2 seconds under normal conditions (< 20 session files)

### Requirement: Clean up stale state files
The system SHALL remove state files in `/tmp/` that no longer correspond to active sessions.

#### Scenario: State file for dead session is removed
- **WHEN** a `/tmp/claude-session-state-<sessionId>.json` exists but no matching session is found in `~/.claude/sessions/`
- **THEN** the state file SHALL be deleted
