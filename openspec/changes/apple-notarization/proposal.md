## Why

macOS users who download the app see a Gatekeeper warning ("app is damaged" or "cannot be opened because the developer cannot be verified") because the `.dmg` and `.app` bundles are not code-signed or notarized. The release workflow currently skips macOS signing entirely (the `APPLE_*` secrets are not configured). Adding code signing with an Apple Development certificate makes the app installable without security workarounds on registered devices, and positions the project for full notarization later.

**Constraint**: Full notarization for public distribution requires the Apple Developer Program ($99/year). This change uses an **Apple Development certificate** (available with a free Apple ID) to enable code signing in CI. This eliminates Gatekeeper warnings on the developer's own machines. Public distribution notarization (Developer ID certificate) can be added later without changing the pipeline structure.

## What Changes

- **Configure Tauri's macOS code signing** in CI using an Apple Development certificate, activated when `APPLE_*` secrets are present.
- **Document the Apple ID and certificate setup** — step-by-step guide for creating an Apple ID, generating an Apple Development certificate via Xcode/Keychain, creating an app-specific password, and exporting the certificate as `.p12` for CI.
- **Update `release.yml`** to pass the required signing environment variables (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`) to `tauri-apps/tauri-action` on macOS runners.
- **Add a CI guard** so the signing step is skipped gracefully (with a warning) when secrets are not configured, keeping the existing unsigned-build behavior intact.
- **Prepare for future notarization** by documenting what additional secrets (`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`) and enrollment steps are needed when upgrading to a Developer ID certificate.

## Capabilities

### New Capabilities
- `macos-code-signing`: Covers macOS code signing with an Apple Development certificate — certificate generation, `.p12` export, CI configuration, Tauri integration, and Apple account setup documentation.

### Modified Capabilities
- `desktop-build-pipeline`: macOS build jobs gain conditional code signing when Apple secrets are present.

## Impact

- **`.github/workflows/release.yml`**: macOS build steps updated to conditionally pass `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, and `APPLE_SIGNING_IDENTITY` env vars to `tauri-action`. Warning logged when secrets are missing.
- **`src-tauri/tauri.conf.json`**: May need `bundle.macOS.signingIdentity` if Tauri 2.x requires explicit config beyond env vars.
- **GitHub Secrets**: Three new secrets once the certificate is generated (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`).
- **Documentation**: Setup guide for generating and exporting the Apple Development certificate, plus a section on upgrading to Developer ID / notarization later.
- **No application code changes** — this is CI/CD, build config, and documentation only.
