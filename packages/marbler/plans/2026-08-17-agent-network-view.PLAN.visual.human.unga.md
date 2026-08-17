# Agent network view, in plain words

## Contents

- [The one-sentence version](#the-one-sentence-version)
- [What you see](#what-you-see)
- [The row](#the-row)
- [The frames](#the-frames)
- [Where the data comes from](#where-the-data-comes-from)
- [The subagent question, answered](#the-subagent-question-answered)
- [Live follow](#live-follow)
- [Build order](#build-order)
- [Three things I need from you](#three-things-i-need-from-you)

## The one-sentence version

Every agent becomes one row that looks like a websocket connection in the Chrome
network tab: a bar showing how long it lived, tick marks on the bar for every
message, and a messages panel when you click it.

## What you see

```mermaid
flowchart TB
  subgraph panel["one panel, three parts"]
    A["overview strip\ndrag to zoom, snaps to now"]
    B["the rows\nindented tree, one per agent"]
    C["drawer\nmessages of the selected agent"]
  end
  A --> B --> C
```

## The row

```mermaid
gantt
  dateFormat X
  axisFormat %S s
  title one row is one agent connection
  section coordinator
  claude sprefa-coordinator  :active, c1, 0, 3600
  section its children
  agent-a20ea02e (subagent)  :s1, 400, 3845
  agent-ace31b09 (subagent)  :s2, 900, 1990
  feature-dl6-id-access (lane) :s3, 1200, 2300
  research-openapi (lane)      :s4, 2400, 3100
```

The bar starts when the agent opened and ends when it exited. A bar with no end
is still running, and that row shows a `101` the same way an open websocket does.
Children sit indented under their parent, and the chevron folds them away.

## The frames

Tick marks sit on the bar. Click the row and you get the list.

```mermaid
sequenceDiagram
  participant P as coordinator
  participant C as subagent
  P->>C: spawn (brief)
  Note over C: turn-start
  Note over C: turn-finish
  P->>C: mail-in (hail)
  C->>P: mail-out (progress)
  Note over C: error
  C->>P: result
  Note over C: exit
```

Eight kinds, colored three ways: arriving, leaving, and happening inside.

| tick | means |
|---|---|
| spawn | somebody started this agent |
| turn-start | it began a turn |
| turn-finish | that turn finished |
| mail-in | a message landed |
| mail-out | it sent a message |
| result | it reported back to its parent |
| error | something broke |
| exit | the connection closed |

## Where the data comes from

Everything already exists on disk. Nothing new gets written.

```mermaid
flowchart LR
  DB[("boop.db\nsessions, spans,\nedges, turns")] --> Q["two named queries\nrows + frames"]
  Q --> N["ndjson, one line each"]
  N --> AD["adapter\nturns lines into rows"]
  AD --> M["marbler panel"]
```

The store already holds 3571 agent sessions, 6771 live spans, 1871 parent-child
edges, and 449943 turns. The view reads and never writes.

## The subagent question, answered

The ones you cannot see when you hit cmd+period ARE in the store. Every Claude
Code Agent-tool subagent lands there with an id like
`ce26f5c3.../agent-ace31b0935a2057db`, a parent, a working directory, and its
whole turn history. 1250 of them.

```mermaid
flowchart LR
  subgraph have["already recorded"]
    H1["id and parent"]
    H2["working directory"]
    H3["first and last turn"]
    H4["every turn, with text"]
  end
  subgraph miss["not recorded yet"]
    M1["which agent type\n(Explore, fork, ...)"]
    M2["a goal or brief"]
    M3["turn-start / turn-finish\nlifecycle events"]
  end
```

So the row draws today. It just says `agent-ace31b09` where you would rather read
`Explore`. Fixing that is a small change on the boop side and I have asked for
it.

## Live follow

The panel already knows how to stick to the right edge as new things arrive. What
it lacks is somebody handing it new data. A one-second tick that re-reads the two
queries is enough, and it skips the redraw entirely when nothing changed.

```mermaid
flowchart LR
  T["tick, 1 second"] --> R["read rows + frames"]
  R --> D{"anything new?"}
  D -->|no| T
  D -->|yes| U["update rows,\nslide the window to now"]
  U --> T
```

## Build order

```mermaid
flowchart LR
  S1["1. adapter\nboop rows to panel rows\n+ a real fixture"]
  S2["2. frames\nticks on the bar,\nmessages in the drawer"]
  S3["3. demo page\nreal agents on screen"]
  S4["4. live follow"]
  S5["5. graph view"]
  S1 --> S3
  S2 --> S3
  S3 --> S4
  S3 --> S5
```

Steps 1 and 2 run at the same time in different packages. Steps 1 through 3 need
no decision from you. Steps 4 and 5 do.

## Three things I need from you

1. How live data reaches the browser: a small dev server that shells out to boop,
   or an endpoint boop serves itself, or a native window that watches the file.
2. Whether the graph picture pulls Instant's existing trace viewer over, or gets
   written fresh here.
3. An agent that is sitting idle with no exit recorded: does that read as an open
   connection, or as unknown? Today the store has exactly one status value and it
   is `idle`, so both readings are available.
