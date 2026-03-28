## 1. Update Release Workflow

- [x] 1.1 Add conditional `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, and `APPLE_SIGNING_IDENTITY` env vars to the `tauri-apps/tauri-action` step for macOS runners in `release.yml`
- [x] 1.2 Add a warning log step that runs when `APPLE_CERTIFICATE` is not set, indicating code signing was skipped

## 2. Documentation

- [x] 2.1 Create macOS code signing setup guide covering: Apple ID creation, certificate generation via Xcode, `.p12` export from Keychain Access, base64 encoding, and GitHub Secrets configuration
- [x] 2.2 Document the three required secrets (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`) with descriptions of what each holds
- [x] 2.3 Document the upgrade path from Apple Development signing to Developer ID + notarization (additional secrets, enrollment steps, signing identity change)
