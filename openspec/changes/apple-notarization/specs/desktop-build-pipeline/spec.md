## MODIFIED Requirements

### Requirement: Code signing configuration
The system SHALL support code signing for macOS and Windows to prevent security warnings.

#### Scenario: macOS code signing
- **WHEN** the macOS build runs with signing secrets configured (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`)
- **THEN** the `.app` bundle and `.dmg` SHALL be signed with the Apple Development certificate
- **AND** the signing identity SHALL be passed via the `APPLE_SIGNING_IDENTITY` environment variable

#### Scenario: macOS unsigned builds
- **WHEN** the macOS build runs
- **AND** `APPLE_CERTIFICATE` secret is not configured
- **THEN** the `APPLE_*` environment variables SHALL be omitted from the build step
- **AND** unsigned `.dmg` and `.app` bundles SHALL be produced
- **AND** a warning SHALL be logged indicating signing was skipped

#### Scenario: Windows code signing
- **WHEN** the Windows build runs with signing secrets configured
- **THEN** the `.msi` and `.exe` SHALL be signed with the Windows certificate
- **AND** SmartScreen warnings SHALL be minimized

#### Scenario: Unsigned builds when secrets absent
- **WHEN** signing secrets (`APPLE_CERTIFICATE`, `WINDOWS_CERTIFICATE`) are not configured in the repository
- **THEN** the workflow SHALL NOT pass signing environment variables to `tauri-apps/tauri-action`
- **AND** the build SHALL complete successfully producing unsigned artifacts
- **AND** no signing-related errors SHALL occur

### Requirement: Required secrets configuration
The system SHALL document all required secrets for the GitHub Actions workflow.

#### Scenario: macOS signing secrets
- **WHEN** configuring the repository secrets for macOS code signing
- **THEN** the following SHALL be set: `APPLE_CERTIFICATE` (base64-encoded .p12), `APPLE_CERTIFICATE_PASSWORD` (p12 export password), `APPLE_SIGNING_IDENTITY` (certificate common name)
- **AND** for future notarization, additionally: `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`

#### Scenario: Windows signing secrets
- **WHEN** configuring the repository secrets
- **THEN** the following SHALL be set: `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`
- **AND** Azure Trusted Signing credentials if using that service

#### Scenario: GitHub token
- **WHEN** the workflow runs
- **THEN** `GITHUB_TOKEN` SHALL be available automatically
- **AND** it SHALL be used for creating releases and uploading artifacts
