const crypto = require('crypto');

/**
 * The Claude Code hook LaunchPad installs to ~/.claude/vscode-launchpad/hook.sh.
 *
 * Embedded as a JS string (not an asset file) so `pkg` always bundles it into
 * the sidecar. Constraints, each deliberate:
 * - POSIX sh, no jq: must work on a stock macOS/Linux machine.
 * - Only `session_id` (an id) and `notification_type` (an enum) are parsed, so
 *   sed extraction is safe; free-text fields such as `cwd` are never parsed.
 * - The session id is allowlisted before it becomes a filename.
 * - Always exits 0: a broken status feature must never surface as a Claude
 *   Code hook error on every turn.
 *
 * String.raw keeps backslashes literal; the script avoids `${...}` so nothing
 * is interpolated by JS.
 */
const HOOK_SCRIPT = String.raw`#!/bin/sh
# VS Code LaunchPad: Claude Code session state hook.
# Managed by LaunchPad (Enable/Repair/Disable in the app); edits are overwritten.
# Reads the hook event JSON on stdin and records the session's state.

state_dir="$HOME/.claude/vscode-launchpad/state"
data=$(cat 2>/dev/null | tr -d '\n\r') || exit 0

json_str() {
  printf '%s' "$data" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n 1
}

session_id=$(json_str session_id)
case "$session_id" in
  ''|*[!A-Za-z0-9_-]*) exit 0 ;;
esac

if [ $# -gt 0 ]; then
  state="$1"
else
  case "$(json_str notification_type)" in
    permission_prompt) state=waiting ;;
    idle_prompt)       state=idle ;;
    *)                 exit 0 ;;
  esac
fi
case "$state" in
  working|waiting|idle) ;;
  *) exit 0 ;;
esac

mkdir -p "$state_dir" 2>/dev/null || exit 0
file="$state_dir/$session_id.json"
tmp="$file.tmp.$$"
if printf '{"type":"%s","ts":%s,"sessionId":"%s"}\n' "$state" "$(date +%s)" "$session_id" > "$tmp" 2>/dev/null; then
  mv -f "$tmp" "$file" 2>/dev/null || rm -f "$tmp" 2>/dev/null
fi
exit 0
`;

const HOOK_SCRIPT_HASH = crypto.createHash('sha256').update(HOOK_SCRIPT).digest('hex');

module.exports = { HOOK_SCRIPT, HOOK_SCRIPT_HASH };
