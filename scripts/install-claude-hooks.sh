#!/bin/bash
# Install Claude Code hooks for VS Code Launchpad session monitoring.
#
# This script safely adds the required hooks to ~/.claude/settings.json
# without overwriting existing hooks or other settings.
#
# Usage:
#   ./scripts/install-claude-hooks.sh          # Install hooks
#   ./scripts/install-claude-hooks.sh --check  # Check if hooks are installed
#   ./scripts/install-claude-hooks.sh --remove # Remove hooks

set -euo pipefail

SETTINGS_FILE="$HOME/.claude/settings.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_SCRIPT="$SCRIPT_DIR/claude-session-hook.sh"
HOOK_MARKER="claude-session-hook.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# ─── Preflight checks ───

if ! command -v jq &>/dev/null; then
  error "jq is required but not installed. Install with: brew install jq"
  exit 1
fi

if [ ! -f "$HOOK_SCRIPT" ]; then
  error "Hook script not found at $HOOK_SCRIPT"
  exit 1
fi

if [ ! -x "$HOOK_SCRIPT" ]; then
  chmod +x "$HOOK_SCRIPT"
  info "Made hook script executable"
fi

# ─── Helpers over the installed hooks ───
#
# Hook commands hold an absolute script path (hooks run from any cwd), so a
# checkout that moves leaves commands that still match by name but point at a
# missing file. Every decision below looks at the actual path, not just the name.

# Our hook commands, one per line, across all three events.
our_commands() {
  jq -r --arg m "$HOOK_MARKER" '
    (.hooks // {}) | .Notification, .UserPromptSubmit, .Stop
    | arrays | .[] | .hooks[]? | .command | strings | select(contains($m))
  ' "$SETTINGS_FILE"
}

# True when every one of the three events has one of our commands.
all_events_hooked() {
  jq -e --arg m "$HOOK_MARKER" '
    (.hooks // {}) as $h
    | ["Notification", "UserPromptSubmit", "Stop"]
    | all(.[]; ($h[.] // []) | arrays | any(.[]; any(.hooks[]?; .command | strings | contains($m))))
  ' "$SETTINGS_FILE" &>/dev/null
}

# The script path in a hook command: up to and including the marker, so
# trailing args (" working", " idle") are dropped.
script_path_of() {
  printf '%s%s\n' "${1%%"$HOOK_MARKER"*}" "$HOOK_MARKER"
}

# Drop every hook entry that runs our script (from any path), keeping all others.
strip_our_hooks() {
  local tmp
  tmp=$(mktemp)
  jq --arg m "$HOOK_MARKER" '
    def strip: if type == "array" then [.[] | select(.hooks | all(.command | contains($m) | not))] else . end;
    if .hooks then
      .hooks.Notification     |= strip |
      .hooks.UserPromptSubmit |= strip |
      .hooks.Stop             |= strip |
      if .hooks.Notification     == [] then del(.hooks.Notification)     else . end |
      if .hooks.UserPromptSubmit == [] then del(.hooks.UserPromptSubmit) else . end |
      if .hooks.Stop             == [] then del(.hooks.Stop)             else . end |
      if .hooks == {} then del(.hooks) else . end
    else . end
  ' "$SETTINGS_FILE" > "$tmp" && mv "$tmp" "$SETTINGS_FILE"
}

# ─── Check mode ───

if [ "${1:-}" = "--check" ]; then
  if [ ! -f "$SETTINGS_FILE" ]; then
    warn "Settings file not found: $SETTINGS_FILE"
    exit 1
  fi
  if ! all_events_hooked; then
    warn "Claude Launchpad hooks are NOT installed"
    exit 1
  fi
  missing=0
  while IFS= read -r script; do
    if [ ! -f "$script" ]; then
      error "Hook points at a missing script: $script"
      missing=1
    fi
  done < <(our_commands | while IFS= read -r cmd; do script_path_of "$cmd"; done | sort -u)
  if [ "$missing" -ne 0 ]; then
    warn "Hooks are stale (checkout moved?). Re-run: $0"
    exit 1
  fi
  info "Claude Launchpad hooks are installed"
  exit 0
fi

# ─── Remove mode ───

if [ "${1:-}" = "--remove" ]; then
  if [ ! -f "$SETTINGS_FILE" ]; then
    warn "No settings file to remove hooks from"
    exit 0
  fi

  strip_our_hooks
  info "Hooks removed from $SETTINGS_FILE"
  exit 0
fi

# ─── Install mode ───

echo "Installing Claude Launchpad hooks..."
echo "  Hook script: $HOOK_SCRIPT"
echo "  Settings:    $SETTINGS_FILE"
echo ""

# Create settings file if it doesn't exist
if [ ! -f "$SETTINGS_FILE" ]; then
  mkdir -p "$(dirname "$SETTINGS_FILE")"
  echo '{}' > "$SETTINGS_FILE"
  info "Created $SETTINGS_FILE"
fi

# Backup
cp "$SETTINGS_FILE" "${SETTINGS_FILE}.bak"
info "Backed up settings to ${SETTINGS_FILE}.bak"

# Already installed for THIS checkout? Only then is there nothing to do.
# Hooks pointing anywhere else (a moved or deleted checkout) are replaced.
existing=$(our_commands)
if [ -n "$existing" ]; then
  current=1
  while IFS= read -r cmd; do
    [ "$(script_path_of "$cmd")" = "$HOOK_SCRIPT" ] || current=0
  done <<< "$existing"
  if [ "$current" -eq 1 ] && all_events_hooked; then
    info "Hooks already installed — nothing to do"
    exit 0
  fi
  warn "Replacing existing hooks that point elsewhere:"
  while IFS= read -r cmd; do
    script_path_of "$cmd"
  done <<< "$existing" | sort -u | sed 's/^/    /'
  strip_our_hooks
fi

# Build the three hook entries
NOTIFICATION_ENTRY=$(cat <<EOF
{
  "matcher": "permission_prompt|idle_prompt",
  "hooks": [{ "type": "command", "command": "$HOOK_SCRIPT" }]
}
EOF
)

PROMPT_ENTRY=$(cat <<EOF
{
  "matcher": "",
  "hooks": [{ "type": "command", "command": "$HOOK_SCRIPT working" }]
}
EOF
)

STOP_ENTRY=$(cat <<EOF
{
  "matcher": "",
  "hooks": [{ "type": "command", "command": "$HOOK_SCRIPT idle" }]
}
EOF
)

# Merge hooks into settings without overwriting existing ones
tmp=$(mktemp)
jq --argjson notif "$NOTIFICATION_ENTRY" \
   --argjson prompt "$PROMPT_ENTRY" \
   --argjson stop "$STOP_ENTRY" '
  # Ensure .hooks exists
  .hooks //= {} |
  # Append to existing arrays (or create new ones)
  .hooks.Notification     = ((.hooks.Notification // []) + [$notif]) |
  .hooks.UserPromptSubmit = ((.hooks.UserPromptSubmit // []) + [$prompt]) |
  .hooks.Stop             = ((.hooks.Stop // []) + [$stop])
' "$SETTINGS_FILE" > "$tmp" && mv "$tmp" "$SETTINGS_FILE"

info "Hooks installed successfully"
echo ""
echo "  New Claude Code sessions will report their state to LaunchPad."
echo "  Existing sessions need to be restarted to pick up the hooks."
echo ""
echo "  To verify:  $0 --check"
echo "  To remove:  $0 --remove"
