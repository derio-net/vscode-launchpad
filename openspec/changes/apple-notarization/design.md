## Context

The release workflow (`release.yml`) builds Tauri desktop apps for macOS, Linux, and Windows. macOS builds currently produce unsigned artifacts because no `APPLE_*` secrets are configured. The `fix-release-builds` change made signing optional (env vars omitted when secrets are absent), so macOS builds succeed but trigger Gatekeeper warnings for users.

The project owner wants to sign macOS builds using an **Apple Development certificate** (free Apple ID) rather than a Developer ID Application certificate ($99/year). This enables signed builds for personal/development use without paid enrollment.

## Goals / Non-Goals

**Goals:**
- Sign macOS `.app` and `.dmg` artifacts with an Apple Development certificate in CI
- Keep unsigned builds working when secrets are absent (no regression)
- Document the full certificate setup process (Apple ID creation, certificate export, GitHub Secrets)
- Structure the pipeline so upgrading to Developer ID + notarization later is a minimal diff

**Non-Goals:**
- Full Apple notarization (requires $99/year Developer ID — future work)
- Windows code signing (separate concern, unchanged)
- App Store distribution (requires different certificate type and review process)
- Auto-updater signature changes (the updater pubkey is a separate concern)

## Decisions

### 1. Use `tauri-apps/tauri-action` built-in signing

**Decision**: Pass `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, and `APPLE_SIGNING_IDENTITY` as environment variables to the existing `tauri-apps/tauri-action@v0` step.

**Why**: The Tauri action already supports macOS code signing via these env vars. No custom signing scripts needed. The action calls `codesign` internally when these variables are present.

**Alternative considered**: Manual `codesign` step after build — rejected because it duplicates what `tauri-action` already does and risks signing the wrong binaries or missing embedded frameworks.

### 2. Conditional signing via GitHub Secrets availability

**Decision**: Use GitHub Actions `if` condition or env-var presence check to skip signing when `APPLE_CERTIFICATE` is not set. This is already partially in place from the `fix-release-builds` change.

**Why**: Allows contributors without Apple credentials to still produce working (unsigned) macOS builds. The workflow doesn't fail on forks or when secrets are unconfigured.

### 3. Apple Development certificate (not Developer ID)

**Decision**: Use an Apple Development certificate type, which is available with a free Apple ID.

**Why**: The owner wants to avoid the $99/year Apple Developer Program fee for now. An Apple Development certificate enables code signing (removes "unknown developer" for the signer's machines) and can be replaced with a Developer ID certificate later without changing the CI pipeline structure — only the certificate content and signing identity string change.

**Trade-off**: Apps signed with Apple Development certificates will still show Gatekeeper warnings on machines that haven't explicitly trusted the certificate. Only Developer ID + notarization fully eliminates Gatekeeper friction for end users.

### 4. Certificate stored as base64-encoded `.p12` in GitHub Secrets

**Decision**: Export the Apple Development certificate and private key as a `.p12` file, base64-encode it, and store as the `APPLE_CERTIFICATE` GitHub Secret. The password used during export goes in `APPLE_CERTIFICATE_PASSWORD`.

**Why**: This is the standard approach used by `tauri-apps/tauri-action` and most macOS CI signing workflows. The action decodes the base64, imports into a temporary keychain, and signs with it.

## Risks / Trade-offs

- **[Limited Gatekeeper bypass]** → Apple Development certificates only suppress warnings on the signer's registered devices, not for arbitrary end users. Mitigation: Document this limitation clearly; upgrading to Developer ID later is a straightforward secret swap.
- **[Certificate expiration]** → Apple Development certificates expire after 1 year. Mitigation: Document renewal process. CI will fail with a clear signing error when expired, not silently produce unsigned builds.
- **[Secret rotation]** → If the certificate is regenerated, all three secrets must be updated together. Mitigation: Document the full rotation steps.
