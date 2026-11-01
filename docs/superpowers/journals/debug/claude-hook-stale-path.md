<!-- fr:journal-schema=3 -->
# Journal: claude-hook-stale-path

<!-- fr:journal kind=repro scope=debug id=b5f75ba2f7ff created=2026-11-01T10:11:41+00:00 -->
### b5f75ba2f7ff · repro · Stop hook fails: claude-session-hook.sh not found at old SIDE_PROJECTS path

Every Stop event: `/bin/sh: .../SIDE_PROJECTS/vscode-launchpad/scripts/claude-session-hook.sh: No such file or directory`. ~/.claude/settings.json holds 3 absolute hook commands (Notification, UserPromptSubmit, Stop) pointing at the pre-move checkout; repo now lives under DERIO_NET/.
