## MODIFIED Requirements

### Requirement: Claude integration gated on hook configuration
The system SHALL hide all Claude session UI elements (column, summary panel, indicators) when hooks are not configured, and SHALL show them when hook configuration is detected asynchronously. The hook management control and repair banner (see below) are not gated.

#### Scenario: Hooks not configured
- **WHEN** the API returns `hookConfigured: false`
- **THEN** the Claude column, summary panel, and all Claude indicators SHALL be hidden

#### Scenario: Hooks are configured
- **WHEN** the API returns `hookConfigured: true`
- **THEN** the Claude column and summary panel SHALL be visible

#### Scenario: Hook configuration detected after initial render
- **WHEN** the component mounts before the API has responded
- **AND** the API subsequently returns `hookConfigured: true`
- **THEN** the Claude column SHALL become visible without requiring a page reload
- **AND** this SHALL NOT override a user's manual column visibility toggle

## ADDED Requirements

### Requirement: Claude Code status control
The dashboard SHALL provide a control for enabling, repairing and disabling the Claude Code hook, driven by the hook installation status.

#### Scenario: Enable when not installed
- **WHEN** the hook status is `not-installed`
- **THEN** the control SHALL offer **Enable Claude Code status**
- **AND** choosing it SHALL call the install endpoint and, on success, reveal the Claude column without a page reload

#### Scenario: Repair when broken
- **WHEN** the hook status is `needs-repair`
- **THEN** the control SHALL offer **Repair**, which calls the install endpoint

#### Scenario: Disable when installed
- **WHEN** the hook status is `installed`
- **THEN** the control SHALL offer **Disable Claude Code status**
- **AND** choosing it SHALL ask for confirmation, call the remove endpoint, and hide the Claude UI

#### Scenario: Unsupported environment
- **WHEN** the hook status is `unsupported`
- **THEN** the control SHALL NOT be shown

#### Scenario: Action fails
- **WHEN** the install or remove request fails
- **THEN** the dashboard SHALL show the error message returned by the server
- **AND** the displayed status SHALL remain unchanged

### Requirement: Repair banner for broken hooks
The dashboard SHALL show a banner when the hook status is `needs-repair`, because a broken hook surfaces as a Claude Code error on every turn.

#### Scenario: Banner shown
- **WHEN** the hook status is `needs-repair`
- **THEN** a banner SHALL explain that the Claude Code hooks point at a missing or outdated script and offer a **Repair** button

#### Scenario: Banner dismissed
- **WHEN** the user dismisses the banner
- **THEN** it SHALL stay hidden for that viewer until the hook status changes

#### Scenario: No banner when simply not installed
- **WHEN** the hook status is `not-installed`
- **THEN** no banner SHALL be shown
