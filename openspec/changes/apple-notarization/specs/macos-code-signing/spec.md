## ADDED Requirements

### Requirement: Apple Development certificate signing
The system SHALL sign macOS `.app` bundles and `.dmg` installers using an Apple Development certificate when the required secrets are configured in GitHub Actions.

#### Scenario: Signed build with secrets present
- **WHEN** the macOS build runs
- **AND** `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, and `APPLE_SIGNING_IDENTITY` secrets are configured
- **THEN** `tauri-apps/tauri-action` SHALL receive these values as environment variables
- **AND** the produced `.app` and `.dmg` SHALL be code-signed

#### Scenario: Unsigned build without secrets
- **WHEN** the macOS build runs
- **AND** `APPLE_CERTIFICATE` secret is not configured
- **THEN** the signing environment variables SHALL be omitted from the build step
- **AND** unsigned `.app` and `.dmg` artifacts SHALL be produced
- **AND** the build SHALL complete successfully

#### Scenario: CI warning on unsigned build
- **WHEN** the macOS build runs without signing secrets
- **THEN** the workflow SHALL log a warning message indicating that code signing was skipped
- **AND** the warning SHALL mention how to configure signing secrets

### Requirement: Certificate setup documentation
The system SHALL provide documentation for generating and configuring the Apple Development certificate for CI use.

#### Scenario: Apple ID creation steps
- **WHEN** a maintainer reads the setup documentation
- **THEN** it SHALL include steps for creating a free Apple ID at appleid.apple.com

#### Scenario: Certificate generation steps
- **WHEN** a maintainer reads the setup documentation
- **THEN** it SHALL include steps for generating an Apple Development certificate via Xcode or Apple Developer portal
- **AND** steps for exporting the certificate and private key as a `.p12` file from Keychain Access
- **AND** steps for base64-encoding the `.p12` file for GitHub Secrets

#### Scenario: GitHub Secrets configuration steps
- **WHEN** a maintainer reads the setup documentation
- **THEN** it SHALL list the three required secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`
- **AND** it SHALL explain what value each secret holds
- **AND** it SHALL document the upgrade path to Developer ID + notarization

### Requirement: Upgrade path to notarization
The system SHALL document the steps needed to upgrade from Apple Development signing to full Developer ID notarization.

#### Scenario: Notarization upgrade documentation
- **WHEN** a maintainer wants to enable notarization
- **THEN** the documentation SHALL list the additional requirements: Apple Developer Program enrollment ($99/year), Developer ID Application certificate, app-specific password
- **AND** it SHALL list the three additional secrets needed: `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
- **AND** it SHALL note that the CI pipeline structure does not change — only secret values and signing identity
