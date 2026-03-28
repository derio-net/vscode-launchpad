# macOS Code Signing Setup

This guide covers signing VS Code Launchpad macOS builds with an Apple Development certificate in CI (GitHub Actions).

## Prerequisites

- A Mac with Xcode installed (for certificate generation)
- A free Apple ID (create at [appleid.apple.com](https://appleid.apple.com) if you don't have one)
- Admin access to the GitHub repository (for configuring secrets)

## 1. Create an Apple ID

If you don't already have one:

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Click "Create Your Apple ID"
3. Fill in your details and verify your email
4. Enable two-factor authentication (required for developer features)

## 2. Generate an Apple Development Certificate

1. Open **Xcode** on your Mac
2. Go to **Xcode → Settings → Accounts**
3. Click **+** to add your Apple ID if it's not already there
4. Select your Apple ID, then click **Manage Certificates...**
5. Click **+** in the bottom-left and select **Apple Development**
6. Xcode will generate and install the certificate in your Keychain

## 3. Export the Certificate as .p12

1. Open **Keychain Access** (Applications → Utilities → Keychain Access)
2. In the left sidebar, select **login** keychain, then **My Certificates** category
3. Find the certificate named **Apple Development: your@email.com (XXXXXXXXXX)**
4. Expand it to confirm the private key is attached (disclosure triangle)
5. Right-click the certificate and select **Export...**
6. Choose **Personal Information Exchange (.p12)** format
7. Save the file (e.g., `apple-dev-cert.p12`)
8. Set a strong password when prompted — you'll need this for `APPLE_CERTIFICATE_PASSWORD`

## 4. Base64-Encode the Certificate

In your terminal:

```bash
base64 -i apple-dev-cert.p12 -o apple-dev-cert-base64.txt
```

The contents of `apple-dev-cert-base64.txt` will be your `APPLE_CERTIFICATE` secret value.

## 5. Find Your Signing Identity

Run this to find the exact identity string:

```bash
security find-identity -v -p codesigning
```

Look for the line containing "Apple Development: your@email.com" — the full string (including the hash in parentheses) is your `APPLE_SIGNING_IDENTITY` value. For example:

```
"Apple Development: user@example.com (A1B2C3D4E5)"
```

Use the quoted portion (without the outer quotes) as the secret value.

## 6. Configure GitHub Secrets

Go to your repository → **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Value | Description |
|--------|-------|-------------|
| `APPLE_CERTIFICATE` | Contents of `apple-dev-cert-base64.txt` | Base64-encoded `.p12` certificate file |
| `APPLE_CERTIFICATE_PASSWORD` | Password you set during `.p12` export | Unlocks the certificate during CI import |
| `APPLE_SIGNING_IDENTITY` | e.g., `Apple Development: user@example.com (A1B2C3D4E5)` | Tells `codesign` which certificate to use |

## 7. Verify

Push a version tag to trigger a release build:

```bash
git tag v0.1.1
git push origin v0.1.1
```

> **Note:** Avoid non-numeric pre-release tags like `v0.1.0-beta.1` — the Windows MSI bundler (WiX) only supports numeric version segments.

Check the GitHub Actions run — the macOS build should now sign the `.app` and `.dmg` artifacts. If signing secrets are not configured, you'll see a warning in the logs instead of an error.

## 8. Clean Up

After configuring secrets, delete the local `.p12` and base64 files:

```bash
rm apple-dev-cert.p12 apple-dev-cert-base64.txt
```

## Limitations of Apple Development Certificates

- **Not notarized**: macOS Gatekeeper will still warn users who download the app from the internet on machines that haven't explicitly trusted this certificate
- **Expires after 1 year**: Regenerate and update secrets when expired
- **Development use**: Intended for personal/testing use, not public distribution

## Upgrading to Developer ID + Notarization

To fully eliminate Gatekeeper warnings for all users, upgrade to a Developer ID certificate with notarization:

### Requirements

- **Apple Developer Program enrollment** ($99/year) at [developer.apple.com/programs](https://developer.apple.com/programs/enroll/)
- A **Developer ID Application** certificate (generated via Xcode or the Apple Developer portal after enrollment)

### Steps

1. Enroll in the Apple Developer Program
2. Generate a **Developer ID Application** certificate (same process as above, but select "Developer ID Application" instead of "Apple Development")
3. Export the new certificate as `.p12` and base64-encode it
4. Generate an **app-specific password** at [appleid.apple.com/account/manage](https://appleid.apple.com/account/manage) → Sign-In and Security → App-Specific Passwords
5. Update existing GitHub Secrets with the new certificate:
   - `APPLE_CERTIFICATE` → new Developer ID `.p12` (base64-encoded)
   - `APPLE_CERTIFICATE_PASSWORD` → new `.p12` password
   - `APPLE_SIGNING_IDENTITY` → e.g., `Developer ID Application: Your Name (TEAM_ID)`
6. Add three new secrets for notarization:

| Secret | Value | Description |
|--------|-------|-------------|
| `APPLE_ID` | Your Apple ID email | Used by `notarytool` to authenticate |
| `APPLE_PASSWORD` | App-specific password | Not your Apple ID password — generated in step 4 |
| `APPLE_TEAM_ID` | Your 10-character Team ID | Found in Apple Developer account → Membership |

7. The release workflow already supports these additional env vars — `tauri-apps/tauri-action` will automatically notarize when all six `APPLE_*` env vars are present

### Adding Notarization Env Vars to the Workflow

Once you have the Developer ID certificate and the three additional secrets, add these to the `Build Tauri app` step in `release.yml`:

```yaml
env:
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

No other workflow changes are needed — `tauri-action` handles notarization automatically when these are present alongside the signing env vars.
