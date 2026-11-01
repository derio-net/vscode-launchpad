#!/bin/bash
# Install, check or remove LaunchPad's Claude Code hooks from a repo checkout.
#
# The desktop app does the same from its UI ("Enable Claude Code status").
# This wrapper is for the web/dev workflow. Both use server/claudeHookInstaller.js:
# the hook script is written to ~/.claude/vscode-launchpad/hook.sh, so it keeps
# working if this checkout moves or is deleted. Running it also migrates old
# installs that pointed at scripts/claude-session-hook.sh.
#
# Usage:
#   ./scripts/install-claude-hooks.sh          # Install (or repair) hooks
#   ./scripts/install-claude-hooks.sh --check  # Exit 0 only if fully installed
#   ./scripts/install-claude-hooks.sh --remove # Remove LaunchPad hooks

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  sed -n 's/^#   //p' "$0"
}

case "${1:-}" in
  "")        action=install ;;
  --check)   action=status ;;
  --remove)  action=remove ;;
  -h|--help) usage; exit 0 ;;
  *)         echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "✗ node is required (the desktop app needs no setup: use 'Enable Claude Code status')." >&2
  exit 1
fi

exec node "$REPO_DIR/server/claudeHookInstaller.js" "$action"
