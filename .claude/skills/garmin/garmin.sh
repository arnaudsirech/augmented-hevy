#!/usr/bin/env bash
# Garmin API helper — queries the local garmin-api server
set -euo pipefail

BASE="http://192.168.1.33:8000"

usage() {
  cat <<'EOF'
Usage: garmin.sh <command> [args]

Commands:
  today              Today's activities
  runs [n]           Last n runs (default 10)
  activity <id>      Full activity detail
  splits <id>        Lap splits for an activity
  weather <id>       Weather for an activity
  stats [date]       Daily stats (default: today, format: YYYY-MM-DD)
  hr [date]          Heart rate time-series (default: today)
  health             API health check
  types              List available activity types
  activities [n] [type]  Last n activities, optionally filtered by type
EOF
  exit 0
}

die() { echo "ERROR: $*" >&2; exit 1; }

get_date() {
  if [ $# -ge 1 ]; then echo "$1"; else date +%Y-%m-%d; fi
}

cmd="${1:-usage}"
shift 2>/dev/null || true

case "$cmd" in
  today)
    curl -s "$BASE/activities/today" | python3 -m json.tool
    ;;
  runs)
    n="${1:-10}"
    curl -s "$BASE/activities?limit=$n&activity_type=running" | python3 -m json.tool
    ;;
  activity)
    [ $# -ge 1 ] || die "activity <id> required"
    curl -s "$BASE/activities/$1" | python3 -m json.tool
    ;;
  splits)
    [ $# -ge 1 ] || die "splits <id> required"
    curl -s "$BASE/activities/$1/splits" | python3 -m json.tool
    ;;
  weather)
    [ $# -ge 1 ] || die "weather <id> required"
    curl -s "$BASE/activities/$1/weather" | python3 -m json.tool
    ;;
  stats)
    curl -s "$BASE/stats/$(get_date "$@")" | python3 -m json.tool
    ;;
  hr)
    curl -s "$BASE/stats/$(get_date "$@")/hr" | python3 -m json.tool
    ;;
  health)
    curl -s "$BASE/health" | python3 -m json.tool
    ;;
  types)
    curl -s "$BASE/activities?limit=1" | python3 -c "
import json, sys
data = json.load(sys.stdin)
types = set()
# This is a quick check — the API doesn't have a dedicated /types endpoint
# but we can hit the generic activities endpoint
"
    # Use a bigger request to sample types
    curl -s "$BASE/activities?limit=100" | python3 -c "
import json, sys
data = json.load(sys.stdin)
types = {}
for a in data.get('activities', []):
    t = a.get('type', 'unknown')
    types[t] = types.get(t, 0) + 1
for t, c in sorted(types.items(), key=lambda x: -x[1]):
    print(f'  {t}: {c}')
"
    ;;
  activities)
    n="${1:-20}"
    t="${2:-}"
    url="$BASE/activities?limit=$n"
    [ -n "$t" ] && url="${url}&activity_type=$t"
    curl -s "$url" | python3 -m json.tool
    ;;
  *)
    usage
    ;;
esac
