#!/usr/bin/env bash
set -euo pipefail

# Matches readAgentNetworkExport's sql(query) contract: one boop db call per
# statement, ndjson on stdout.

cd "$(dirname "$0")/.."

SINCE="${1:-1786970000000}"
ROWS_FIXTURE="fixtures/2026-08-17-agent-network.rows.ndjson"
FRAMES_FIXTURE="fixtures/2026-08-17-agent-network.frames.ndjson"

ROWS_SQL="WITH sess AS (
  SELECT s.session_id AS sid, d.value AS session, h.value AS harness, s.nickname,
         c.value AS cwd, b.value AS branch, s.started_ts
  FROM agent_session s
  JOIN dict_session d ON d.id = s.session_id
  JOIN dict_harness h ON h.id = s.harness_id
  LEFT JOIN dict_cwd    c ON c.id = s.cwd_id
  LEFT JOIN dict_branch b ON b.id = s.branch_id
), span AS (
  SELECT session_id AS sid, MIN(from_ts) AS opened_ts,
         CASE WHEN SUM(to_ts IS NULL) > 0 THEN NULL ELSE MAX(to_ts) END AS closed_ts
  FROM agent_live_span GROUP BY session_id
), turns AS (
  SELECT session_id AS sid, MIN(ts) AS first_turn_ts, MAX(ts) AS last_turn_ts,
         COUNT(*) AS turns
  FROM agent_turn GROUP BY session_id
), parent AS (
  SELECT e.child_session_id AS sid, p.value AS parent, MIN(e.first_ts) AS spawned_ts
  FROM agent_edge e
  JOIN dict_edekind k ON k.id = e.edge_kind_id AND k.value = 'spawned'
  JOIN dict_session p ON p.id = e.parent_session_id
  GROUP BY e.child_session_id
), lane AS (
  SELECT l.lane_id AS sid, l.goal, m.value AS model, MAX(l.spawned_ts) AS lane_ts
  FROM agent_lane l LEFT JOIN dict_model m ON m.id = l.model_id
  GROUP BY l.lane_id
)
SELECT sess.session, sess.harness, sess.nickname, sess.cwd,
       COALESCE(sess.branch, '') AS branch, lane.model, lane.goal,
       parent.parent, parent.spawned_ts AS spawnedTs,
       span.opened_ts AS openedTs, span.closed_ts AS closedTs,
       turns.first_turn_ts AS firstTurnTs, turns.last_turn_ts AS lastTurnTs,
       COALESCE(turns.turns, 0) AS turns
FROM sess
LEFT JOIN span   ON span.sid   = sess.sid
LEFT JOIN turns  ON turns.sid  = sess.sid
LEFT JOIN parent ON parent.sid = sess.sid
LEFT JOIN lane   ON lane.sid   = sess.sid
WHERE COALESCE(span.opened_ts, turns.first_turn_ts, sess.started_ts) >= ${SINCE}
ORDER BY COALESCE(span.opened_ts, turns.first_turn_ts, sess.started_ts);"

boop db "$ROWS_SQL" > "$ROWS_FIXTURE"

# Session set for the frames query, quoted and comma joined.
SESSION_LIST=$(python3 - "$ROWS_FIXTURE" <<'PY'
import json, sys
with open(sys.argv[1]) as handle:
    sessions = [json.loads(line)["session"] for line in handle if line.strip()]
quoted = ",".join("'" + s.replace("'", "''") + "'" for s in sessions)
print(quoted)
PY
)

FRAMES_SQL="SELECT d.value AS session, e.first_ts AS ts, k.value AS kind, p.value AS peer,
       '' AS detail, e.n AS repeat
FROM agent_edge e
JOIN dict_edekind k ON k.id = e.edge_kind_id
JOIN dict_session d ON d.id = e.child_session_id
JOIN dict_session p ON p.id = e.parent_session_id
WHERE e.first_ts >= ${SINCE}
UNION ALL
SELECT l.value, te.created_ts, tk.value, NULL, te.detail, 1
FROM agent_trace_event te
JOIN dict_trace_kind tk ON tk.id = te.kind_id
JOIN dict_session l ON l.id = te.lane_id
WHERE te.created_ts >= ${SINCE}
UNION ALL
SELECT d.value, t.ts, r.value, NULL, SUBSTR(COALESCE(t.said, ''), 1, 200), 1
FROM agent_turn t
JOIN dict_session d ON d.id = t.session_id
JOIN dict_role r ON r.id = t.role_id
WHERE t.session_id IN (SELECT id FROM dict_session WHERE value IN (${SESSION_LIST}))
  AND t.ts >= ${SINCE}
  AND d.value LIKE '%/agent-%';"

boop db "$FRAMES_SQL" > "$FRAMES_FIXTURE"

echo "wrote $(wc -l < "$ROWS_FIXTURE") rows to $ROWS_FIXTURE"
echo "wrote $(wc -l < "$FRAMES_FIXTURE") frames to $FRAMES_FIXTURE"
