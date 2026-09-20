#!/usr/bin/env bash
# Dev tmux session: backend + mobile + otel-collector logs, plus a claude
# pane and a scratch bash pane. Postgres runs as a background container
# (task dev:db), not a pane of its own — nothing there to watch day to day.
set -euo pipefail

command -v tmux >/dev/null || { echo "tmux not found — install it first." >&2; exit 1; }

cd "$(dirname "$0")/.."

SESSION=garde-manger-dev
EXPECTED_PANES=5

if tmux has-session -t "$SESSION" 2>/dev/null; then
  actual=$(tmux list-panes -t "$SESSION:dev" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$actual" = "$EXPECTED_PANES" ]; then
    exec tmux attach -t "$SESSION"
  fi
  # A previous run died mid-build (e.g. a split that didn't fit) and left a
  # partial session behind — rebuild instead of reattaching to that.
  echo "Existing '$SESSION' session looks incomplete ($actual/$EXPECTED_PANES panes) — rebuilding." >&2
  tmux kill-session -t "$SESSION"
fi

task dev:db

# -x/-y: a detached session has no real client yet, so tmux would otherwise
# size new panes against a small placeholder (~80x24) and later splits can
# fail to fit before anything ever attaches — tmux resizes to the real
# terminal automatically once a client does attach.
tmux new-session -d -s "$SESSION" -n dev -x 220 -y 50 -c "$PWD"

# Session-scoped (not -g), so this doesn't touch mouse behavior in the
# user's other tmux sessions.
tmux set-option -t "$SESSION" mouse on

# Build every pane first, keys last: each split resizes the whole window,
# and that resize can interrupt/discard keys already sent to a pane created
# a moment earlier if its shell hasn't finished reading them yet — sending
# every command only once the layout is final avoids the race entirely.
tmux split-window -h -t "$SESSION:dev.0" -c "$PWD"
tmux split-window -v -t "$SESSION:dev.0" -c "$PWD"
tmux split-window -v -t "$SESSION:dev.1" -c "$PWD"
tmux split-window -v -t "$SESSION:dev.2" -c "$PWD"

tmux select-layout -t "$SESSION:dev" tiled

tmux send-keys -t "$SESSION:dev.0" 'task backend:dev' C-m
tmux send-keys -t "$SESSION:dev.1" 'task mobile:dev' C-m
tmux send-keys -t "$SESSION:dev.2" 'task obs:logs' C-m
tmux send-keys -t "$SESSION:dev.3" 'claude' C-m
# dev.4: scratch bash pane, nothing to send.

tmux select-pane -t "$SESSION:dev.0"

exec tmux attach -t "$SESSION"
