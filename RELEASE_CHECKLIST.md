# Release Checklist

Use this checklist when preparing a new release of VS Code Launchpad.

## Pre-Release

### Version Updates
- [ ] Update version in `package.json`
- [ ] Update version in `src-tauri/tauri.conf.json`
- [ ] Update version in `src-tauri/Cargo.toml`
- [ ] Update `CHANGELOG.md` with new version and changes

### Code Quality
- [ ] Run linting: `npm run lint` (if available)
- [ ] Test locally in development mode
- [ ] Test desktop app build locally

### Documentation
- [ ] Update `README.md` if features changed
- [ ] Update `BUILD.md` if build process changed
- [ ] Ensure all new features are documented

## Testing

### Local Testing
- [ ] Test on macOS (Intel)
- [ ] Test on macOS (Apple Silicon) - if available
- [ ] Test on Windows - if available
- [ ] Test on Linux - if available

### Feature Testing
- [ ] Workspace scanning works correctly
- [ ] Search and filter functionality works
- [ ] Sorting works for all columns
- [ ] Opening workspaces in VS Code works
- [ ] Tooltips display correctly
- [ ] Auto-refresh works (wait 30 seconds)

### Desktop App Testing
- [ ] App launches successfully
- [ ] Backend service starts automatically
- [ ] Window state is saved and restored
- [ ] Menu items work correctly
- [ ] System tray works (if enabled)
- [ ] Auto-updater checks for updates

## Release Process

### Create Release Tag
```bash
git checkout main
git pull origin main
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### GitHub Actions
- [ ] Verify GitHub Actions workflow triggers
- [ ] Wait for all platform builds to complete
- [ ] Check that all artifacts are generated:
  - [ ] macOS `.dmg` (Intel)
  - [ ] macOS `.dmg` (Apple Silicon)
  - [ ] Linux `.AppImage`
  - [ ] Linux `.deb`
  - [ ] Windows `.msi`
  - [ ] Windows `.exe`

### GitHub Release
- [ ] Review the draft release created by GitHub Actions
- [ ] Verify release notes are accurate
- [ ] Test download links
- [ ] Publish the release (or keep as draft for pre-release)

## Post-Release

### Verification
- [ ] Download and test the release artifacts
- [ ] Verify auto-updater works (if applicable)
- [ ] Check that version numbers are correct in the app

### Communication
- [ ] Announce the release (if applicable)
- [ ] Update any external documentation
- [ ] Close related issues and milestones

### Monitoring
- [ ] Monitor for bug reports
- [ ] Check GitHub Actions for any build failures
- [ ] Monitor download statistics

## Beta/Pre-Release

For beta releases, use the tag format: `v1.0.0-beta.1`

- [ ] Mark release as "Pre-release" on GitHub
- [ ] Add "beta" label to release notes
- [ ] Communicate that this is a testing release

## Emergency Hotfix

For critical bug fixes:

1. Create a hotfix branch from the release tag
2. Apply the fix
3. Test thoroughly
4. Create new tag with patch version bump (e.g., `v1.0.1`)
5. Fast-track through the checklist

## Notes

- Always test on a clean system if possible (VM or fresh install)
- Keep previous release artifacts for rollback purposes
- Document any known issues in the release notes
- Consider code signing requirements for macOS and Windows
