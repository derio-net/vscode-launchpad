# Sidecar rejected by Gatekeeper on macOS 26

## Symptom

The installed 0.2.0 release app on macOS 26.5.2 (25F84, arm64) starts but
throws: `"Failed to load workspaces: Backend service did not start in time"`.

Diagnostics show `health_check: FAIL` — the sidecar (pkg-bundled Node.js
server) never responds on port 3010.

## Reproduction

```bash
# Attempt to run the release sidecar directly:
/Applications/VS\ Code\ Launchpad.app/Contents/MacOS/sidecar-vscode-dashboard
# → exits silently with code 137 (SIGKILL), no output
```

Building from source (ad-hoc signed) works fine:

```bash
npm run build:sidecar
./src-tauri/binaries/sidecar-vscode-dashboard-aarch64-apple-darwin
# → health endpoint responds, server runs normally
```

## Evidence

| Check | Release binary | Locally-built |
|-------|----------------|---------------|
| `codesign -d -vvv` | Apple Dev cert (signed) | Ad-hoc signed |
| Hardened Runtime | Yes (`flags=0x10000`) | No (`flags=0x2`) |
| `spctl -a -v` | `rejected` | `rejected` (but runs) |
| `assessment:remote` | `true` (checked) | N/A |
| `assessment:verdict` | `false` | N/A |
| Mach-O `minos` | 11.0 | 11.0 |
| Mach-O `sdk` | 13.0 | 13.0 |

The binaries are structurally identical (same `pkg` output). The difference is
the **code signature**: the release sidecar is signed with an Apple Development
certificate and hardened runtime, triggering macOS 26's remote notarization
check. Without a notarization ticket, the OS kills the process (SIGKILL, exit
137). Ad-hoc signing bypasses the notarization requirement.

The main Tauri binary has the same signing profile but works because the user
can grant a one-time Gatekeeper exception via System Settings → Privacy &
Security → "Allow Anyway". The sidecar is spawned as a subprocess and never
gets its own Gatekeeper UI prompt.

## Root Cause

macOS 26 requires **notarization** for any Mach-O binary signed with a
developer certificate AND hardened runtime (`flags=0x10000`). The sidecar
binary built by `pkg` and then signed by the Tauri bundler during `tauri
build` lacks a notarization ticket, so the OS kills it silently on launch.

This is a regression from earlier macOS versions (≤15) where unnotarized but
signed binaries could still run with a one-time Gatekeeper override.

## Rejected Hypotheses

- **pkg/node18 binary incompatible with macOS 26**: Rejected — the same pkg
  binary, when ad-hoc signed, runs perfectly.
- **Quarantine attribute**: Rejected — removing `com.apple.quarantine` and
  `com.apple.provenance` had no effect.
- **LC_BUILD_VERSION / minos**: Rejected — both good and bad binaries have
  `minos 11.0` / `sdk 13.0`.

## Fix

Ad-hoc sign the sidecar binary in the release pipeline after the Tauri build
completes, then re-sign the app bundle with the developer certificate. This
prevents the hardened runtime / notarization requirement from applying to the
sidecar while keeping the main app properly signed.

**File changes:**

- `.github/workflows/release.yml`: Add post-build signing fixup step for
  macOS builds

## Verification

1. Run the post-build fixup script locally against a built .app bundle
2. Confirm the sidecar inside the bundle is ad-hoc signed (`flags=0x2`)
3. Confirm the app bundle validates with `codesign --verify`
4. Confirm the sidecar starts and responds to `GET /health`
