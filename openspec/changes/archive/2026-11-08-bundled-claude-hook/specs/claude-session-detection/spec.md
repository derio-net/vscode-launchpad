## MODIFIED Requirements

### Requirement: Determine session state from hook state files
The system SHALL read session state from `~/.claude/vscode-launchpad/state/<sessionId>.json` files written by the LaunchPad Claude Code hook. The location SHALL be derived from the user's home directory, not from the temporary directory, so the hook and the scanner always agree.

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

#### Scenario: Temporary directory differs between processes
- **WHEN** the server's `TMPDIR` differs from the environment Claude Code runs hooks in (e.g. macOS `/var/folders/…` vs `/tmp`)
- **THEN** the scanner SHALL still read the state written by the hook

### Requirement: Gate feature on hook configuration
The system SHALL enable the feature only when the hook installation status is `installed` (see `claude-hook-installer`): all three hook types configured with the current LaunchPad hook, and the hook script present on disk.

#### Scenario: Hooks are configured
- **WHEN** the hook installation status is `installed`
- **THEN** `hookConfigured` SHALL be `true` in the API response

#### Scenario: Only partial hooks configured
- **WHEN** `~/.claude/settings.json` contains the LaunchPad hook in some but not all three required hook types
- **THEN** `hookConfigured` SHALL be `false` in the API response
- **AND** the sessions array SHALL be empty

#### Scenario: Hook script missing
- **WHEN** all three hook types reference a hook script that does not exist on disk
- **THEN** `hookConfigured` SHALL be `false` in the API response
- **AND** the sessions array SHALL be empty

#### Scenario: Hooks are not configured
- **WHEN** the required hooks are missing from `~/.claude/settings.json`
- **THEN** `hookConfigured` SHALL be `false` in the API response
- **AND** the sessions array SHALL be empty

### Requirement: Clean up stale state files
The system SHALL remove state files in `~/.claude/vscode-launchpad/state/` that no longer correspond to active sessions.

#### Scenario: State file for dead session is removed
- **WHEN** `~/.claude/vscode-launchpad/state/<sessionId>.json` exists but no matching session is found in `~/.claude/sessions/`
- **THEN** the state file SHALL be deleted

#### Scenario: State directory does not exist
- **WHEN** `~/.claude/vscode-launchpad/state/` does not exist
- **THEN** cleanup SHALL do nothing and SHALL NOT log an error
