---
name: garmin-run-data
description: Query the user's Garmin Connect run/activity data via the local garmin-api server.
---

# Garmin Run Data

Query Arnaud's live Garmin Connect data through the REST API running on the home server.

**Base URL:** `http://192.168.1.33:8000`

## Endpoints

### List activities
```
GET /activities?start=0&limit=20&activity_type=running
```
- `start` — pagination index (default 0)
- `limit` — max results (1–100, default 20)
- `activity_type` — filter: `running`, `cycling`, `strength_training`, `swimming`, etc.

Returns: `{ start, limit, count, activities: [{ id, name, type, start_time, distance_m, duration_s, calories, avg_hr, max_hr, steps }] }`

### Today's activities
```
GET /activities/today
```
Returns detailed list for the current day including lap_count and intensity minutes.

### Single activity detail
```
GET /activities/{id}
```
Full detail: pace, cadence, stride length, vertical oscillation, ground contact time, training effect, training load, recovery HR, RPE, etc.

### Activity splits (laps)
```
GET /activities/{id}/splits
```

### Activity weather
```
GET /activities/{id}/weather
```

### Daily stats
```
GET /stats/{YYYY-MM-DD}
```
Steps, HR (resting/min/max), stress, body battery, SpO2, intensity minutes, floors.

### Heart rate time-series
```
GET /stats/{YYYY-MM-DD}/hr
```
2-minute interval HR data for the day.

### Health check
```
GET /health
```

## Quick curl reference

```bash
# Today's runs
curl -s http://192.168.1.33:8000/activities/today | python3 -m json.tool

# Last 10 runs
curl -s 'http://192.168.1.33:8000/activities?limit=10&activity_type=running' | python3 -m json.tool

# Specific run detail
curl -s http://192.168.1.33:8000/activities/23844226058 | python3 -m json.tool

# Today's stats
curl -s http://192.168.1.33:8000/stats/$(date +%Y-%m-%d) | python3 -m json.tool
```

## Helper script

Run `.claude/skills/garmin/garmin.sh <endpoint>` for quick queries:
```bash
.claude/skills/garmin/garmin.sh today          # today's activities
.claude/skills/garmin/garmin.sh runs 10        # last 10 runs
.claude/skills/garmin/garmin.sh activity 23844226058  # specific activity
.claude/skills/garmin/garmin.sh stats           # today's stats
.claude/skills/garmin/garmin.sh stats 2026-08-03
```
