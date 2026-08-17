import { agentNetworkExportSchema, type AgentNetworkExport } from "./0_types.js"

export const AGENT_NETWORK_ROWS_SQL = `WITH sess AS (
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
WHERE COALESCE(span.opened_ts, turns.first_turn_ts, sess.started_ts) >= :since
ORDER BY COALESCE(span.opened_ts, turns.first_turn_ts, sess.started_ts);`

export const AGENT_NETWORK_FRAMES_SQL = `SELECT d.value AS session, e.first_ts AS ts, k.value AS kind, p.value AS peer,
       '' AS detail, e.n AS repeat
FROM agent_edge e
JOIN dict_edekind k ON k.id = e.edge_kind_id
JOIN dict_session d ON d.id = e.child_session_id
JOIN dict_session p ON p.id = e.parent_session_id
WHERE e.first_ts >= :since
UNION ALL
SELECT l.value, te.created_ts, tk.value, NULL, te.detail, 1
FROM agent_trace_event te
JOIN dict_trace_kind tk ON tk.id = te.kind_id
JOIN dict_session l ON l.id = te.lane_id
WHERE te.created_ts >= :since
UNION ALL
SELECT d.value, t.ts, r.value, NULL, SUBSTR(COALESCE(t.said, ''), 1, 200), 1
FROM agent_turn t
JOIN dict_session d ON d.id = t.session_id
JOIN dict_role r ON r.id = t.role_id
WHERE t.session_id IN (SELECT id FROM dict_session WHERE value IN (:sessions))
  AND t.ts >= :since;`

function parseNdjson(text: string): unknown[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line))
}

export function readAgentNetworkExport(sql: (query: string) => string): AgentNetworkExport {
  const rows = parseNdjson(sql(AGENT_NETWORK_ROWS_SQL))
  const frames = parseNdjson(sql(AGENT_NETWORK_FRAMES_SQL))
  return agentNetworkExportSchema.parse({ rows, frames })
}
