# Boop agent adapters

The adapter package accepts a validated `boop-agent/1` snapshot and projects it
into records already owned by the consuming packages.

| Projection | Existing contract | Export |
| --- | --- | --- |
| Agent tree | `@hafley66/grid` `GridConfig.getRowId` / `getSubRows` / `GridTree` rows | `projectAgentTree` |
| Agent timeline | `@hafley66/marbler` `MarbleEvent`, `MarblePhase`, and waterfall rows | `projectAgentTimeline` |
| Agent topology | `@hafley66/grapht` `Topology` and indexed geometry edges | `projectAgentTopology` |
| Agent address | `@hafley66/path` `route` | `boopAgentRoute` |

Node identities are `${harness}:${id}`. Event IDs use the producer event `id`.
Events and communications are never deduplicated. Missing timestamps remain `null`; phases without both
endpoints are omitted from the waterfall phase list.
