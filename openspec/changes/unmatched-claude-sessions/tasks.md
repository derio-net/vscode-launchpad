## 1. Shared open-in-VS-Code helpers

- [x] 1.1 Write failing tests in `src/utils/workspaceUtils.test.js` for `folderToVSCodeUri` (plain path, spaces, `#`, trailing slash) and for `toVSCodeUri` covering local, `file://`-prefixed, ssh-remote, dev-container and attached-container workspaces (same outputs as today's `convertToVSCodeURI`)
- [x] 1.2 Write failing tests for `openVSCodeUri`: Tauri mode invokes `open_vscode` with the URI; if invoke rejects, it falls back to the shell `open`; browser mode sets `window.location.href`
- [x] 1.3 Implement `toVSCodeUri`, `folderToVSCodeUri` and `openVSCodeUri` in `src/utils/workspaceUtils.js` (moved from `WorkspaceTable`); make 1.1–1.2 pass
- [x] 1.4 Make `WorkspaceTable` use the shared helpers, keeping its web-mode remote-workspace handling; existing frontend tests and `e2e/workspace-opening.spec.js` stay green

## 2. Unmatched-session grouping

- [x] 2.1 Write failing tests in `src/hooks/__tests__/useClaudeSessions.test.js` for `groupUnmatchedSessions`: matched sessions excluded; zombies excluded; same-folder sessions grouped with per-state counts and aggregate state; trailing-slash folders merged; ordering waiting > working > idle, then name; empty input → `[]`
- [x] 2.2 Implement and export `groupUnmatchedSessions(sessions, sessionMap)`; return `unmatched` from `useClaudeSessions` (memoised on `sessions` and `sessionMap`)

## 3. "Other sessions" in the summary panel

- [x] 3.1 Write failing tests in `src/components/__tests__/ClaudeSessionSummary.test.js`: section shown only when `unmatched` is non-empty; entry shows folder name with full-path tooltip, counts and state dot; **Open in VS Code** calls `openVSCodeUri` with the folder URI and calls `onOpenFolder`; more than 5 folders → 5 shown plus "Show all (N)", which reveals the rest; zombies section unchanged
- [x] 3.2 Implement the section in `src/components/ClaudeSessionSummary.js` with styles in `ClaudeSessionSummary.css` using existing design tokens (works at narrow widths)
- [x] 3.3 In `Dashboard.js`, pass `unmatched` and `onOpenFolder` (schedules one `onRefresh()` about 10 s later, cleared on unmount) to `ClaudeSessionSummary`

## 4. Filter empty state

- [x] 4.1 Write failing tests: with the working filter active, no matching rows, and an unmatched working session, `WorkspaceTable` shows the explanatory message; otherwise it shows "No workspaces found"
- [x] 4.2 Compute `emptyMessage` in `Dashboard.js` from `claudeFilter` and `unmatched`, and render it in `WorkspaceTable`'s no-results row (default unchanged)

## 5. End-to-end and docs

- [x] 5.1 Add Playwright cases to `e2e/claude-sessions.spec.js` with mocked sessions: one in an unknown folder appears under "Other sessions" with an Open button; activating its state filter shows the explanatory empty message
- [x] 5.2 Update the README "Claude Code Integration" section: sessions in folders VS Code doesn't list appear under "Other sessions", and Open adds them

## 6. Verification

- [x] 6.1 `npm run test:all` and the Chromium E2E suite green
- [ ] 6.2 Manual check in the desktop app: a session in a folder not in the list appears under "Other sessions"; **Open in VS Code** opens it; after the refresh the folder has a row with the session indicator and leaves "Other sessions"
