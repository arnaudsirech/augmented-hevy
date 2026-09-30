#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${DEPLOY_HOST:-$(grep -E '^DEPLOY_HOST=' "$DIR/.env" | cut -d= -f2-)}"
: "${HOST:?DEPLOY_HOST absent de .env (ex. user@serveur)}"

rsync -av --delete \
  --exclude node_modules --exclude .git --exclude web --exclude server \
  --exclude coach/state \
  --exclude coach/journal.md --exclude coach/journal-runs.md \
  "$DIR/" "$HOST:~/augmented-hevy/"

rsync -av "$DIR/.env" "$HOST:~/augmented-hevy/.env"
rsync -av "$DIR/coach/systemd/" "$HOST:~/.config/systemd/user/"
ssh "$HOST" 'systemctl --user daemon-reload && systemctl --user restart hevy-coach.timer hevy-coach-runs.timer'
