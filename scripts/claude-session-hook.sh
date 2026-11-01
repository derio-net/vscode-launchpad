#!/bin/sh
# Compatibility shim for Claude Code hooks installed before LaunchPad bundled
# its hook (they point at this file in a checkout).
#
# Deleting this file would make Claude Code print "No such file or directory"
# on every turn for those users. Instead it forwards to the bundled hook when
# installed, and otherwise does nothing. LaunchPad still reports such installs
# as "needs-repair" and offers Repair, which replaces these entries.
hook="$HOME/.claude/vscode-launchpad/hook.sh"
if [ -f "$hook" ]; then
  exec /bin/sh "$hook" "$@"
fi
cat >/dev/null 2>&1
exit 0
