<!-- fr:journal-schema=3 -->
# Journal: claude-hook-stale-path

<!-- fr:journal kind=repro scope=debug id=b5f75ba2f7ff created=2026-11-01T10:11:41+00:00 -->
### b5f75ba2f7ff · repro · Stop hook fails: claude-session-hook.sh not found at old SIDE_PROJECTS path

Every Stop event: `/bin/sh: .../SIDE_PROJECTS/vscode-launchpad/scripts/claude-session-hook.sh: No such file or directory`. ~/.claude/settings.json holds 3 absolute hook commands (Notification, UserPromptSubmit, Stop) pointing at the pre-move checkout; repo now lives under DERIO_NET/.

<!-- fr:journal kind=ruled-out scope=debug id=1288c40d09c7 created=2026-11-01T10:11:45+00:00 -->
### 1288c40d09c7 · ruled-out · Not a tracked repo config

Repo .claude/settings.json and settings.local.json contain no hook paths; the stale path lives only in user-level ~/.claude/settings.json, written by scripts/install-claude-hooks.sh.

<!-- fr:journal kind=root-cause scope=debug id=52488933d084 created=2026-11-01T10:11:49+00:00 -->
### 52488933d084 · root-cause · Hook installer and scanner detect hooks by script name, not by a resolvable path

install-claude-hooks.sh:107 skips install when any Notification command *contains* 'claude-session-hook.sh' — so after the checkout moved, re-running the installer says 'already installed' and leaves the dead absolute path. --check (line 53) and server/claudeSessionScanner.js checkHookConfigured (line 43) use the same name-only match, so both report healthy hooks pointing at a missing file. Absolute paths are inherent (hooks run from arbitrary cwd); the defect is that a moved checkout cannot self-heal and nothing reports it.
