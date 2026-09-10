#!/usr/bin/env bash
set -euo pipefail
HOST=192.168.1.33
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

rsync -av --delete \
  --exclude node_modules --exclude .git --exclude web --exclude server \
  --exclude coach/state \
  "$DIR/" "$HOST:~/augmented-hevy/"

rsync -av "$DIR/.env" "$HOST:~/augmented-hevy/.env"
rsync -av "$DIR/coach/systemd/" "$HOST:~/.config/systemd/user/"
ssh "$HOST" 'systemctl --user daemon-reload && systemctl --user restart hevy-coach.timer hevy-coach-runs.timer'
