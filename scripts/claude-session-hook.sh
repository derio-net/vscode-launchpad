#!/bin/bash
# Claude Code session state hook for VS Code Launchpad
#
# This script is called by Claude Code hooks (Notification, UserPromptSubmit, Stop).
# It writes session state to /tmp/claude-session-state-<sessionId>.json
# so the LaunchPad backend can read precise session state.
#
# Usage in ~/.claude/settings.json:
#   "hooks": {
#     "Notification": [{
#       "matcher": "permission_prompt|idle_prompt",
#       "hooks": [{ "type": "command", "command": "/path/to/claude-session-hook.sh" }]
#     }],
#     "UserPromptSubmit": [{
#       "matcher": "",
#       "hooks": [{ "type": "command", "command": "/path/to/claude-session-hook.sh working" }]
#     }],
#     "Stop": [{
#       "matcher": "",
#       "hooks": [{ "type": "command", "command": "/path/to/claude-session-hook.sh idle" }]
#     }]
#   }

set -euo pipefail

# Read hook JSON from stdin
data=$(cat)

# Extract session_id from the hook JSON
session_id=$(echo "$data" | jq -r '.session_id // empty')
if [ -z "$session_id" ]; then
  exit 0  # No session ID — nothing to write
fi

# Determine the state type:
# - If an argument is passed (e.g., "working" or "idle"), use it directly
# - Otherwise, extract notification_type from the Notification hook JSON
if [ -n "${1:-}" ]; then
  state_type="$1"
else
  state_type=$(echo "$data" | jq -r '.notification_type // "unknown"')
  # Map notification types to our state names
  case "$state_type" in
    permission_prompt) state_type="waiting" ;;
    idle_prompt)       state_type="idle" ;;
  esac
fi

# Extract CWD for context
cwd=$(echo "$data" | jq -r '.cwd // empty')

# Write state file atomically (write to temp, then move)
state_file="/tmp/claude-session-state-${session_id}.json"
tmp_file="${state_file}.tmp.$$"

cat > "$tmp_file" <<EOF
{"type":"${state_type}","ts":$(date +%s),"cwd":"${cwd}","sessionId":"${session_id}"}
EOF

mv "$tmp_file" "$state_file"
