# Feature status

Explore diagrams, inspect connections, and keep manual arrangements when source changes. The plans below describe the proposed interaction experience. Their individual pieces have source references; integration and acceptance remain open.

| Proposed experience | Existing evidence | Remaining work |
| --- | --- | --- |
| Open a diagram in source declaration order | [anim grid ordering](https://github.com/hafley66/anim/blob/main/src/core/layout.ts) | [Carry source order through ingest and initial layout](./plan-source-order) |
| Keep your arrangement across source edits | [sequence placement reconciliation](https://github.com/hafley66/hafley-rxjs/blob/main/packages/grapht-model/src/4_sequencePlacement.ts) | [General graph identity and matching policy](./plan-graph-identity) |
| Select nodes to inspect callers, dependencies, or immediate neighbors; hover to preview | [anim queries](https://github.com/hafley66/anim/blob/main/src/core/views.ts), [interaction wiring](https://github.com/hafley66/anim/blob/main/src/AtlasPanel.tsx) | [Connect neighborhood queries to grapht](./plan-neighbor-highlighting) |
| See nearby connections strongly, with distant hops fading in the same color | [signed hop distances](https://github.com/hafley66/anim/blob/main/src/core/views.ts) | [Derive and render distance opacity](./plan-hop-gradient) |
| Move and collapse nested groups | [DOM group movement](https://github.com/hafley66/anim/blob/main/src/CssGraph.ts), [sequence collapse](https://github.com/hafley66/hafley-rxjs/blob/main/packages/grapht/src/1_sequence/5_collapse.ts) | [DOM collapse and scoped layout behavior](./plan-dom-groups-and-collapse) |
| Undo a completed drag and optionally restore arrangements after reload | [signal-backed rectangle journal](https://github.com/hafley66/hafley-rxjs/blob/main/packages/react-dock-and-flow/src/2_rectangleJournal.ts) | [Optional movement journal and persistence](./plan-optional-movement-journal) |

## What the evidence establishes

Source references establish that a component exists. They do not establish an integrated grapht feature or browser parity. Anim's DOM collapse methods are currently empty; its canvas renderer uses a collapse plugin. Grapht's existing offline journal records source revisions; the proposed movement journal records user interaction.

Each plan records lifetime, storage, identity joins, unresolved policy, and acceptance checks. Read-only rendering requires no movement journal. Proposed signatures use schematic types and are not copy-paste API examples.

## Delivery evidence

A feature moves out of this section when its exported contract, connected caller path, deterministic fixtures, and relevant browser behavior have been checked. Verification should record the command, source revision, observed result, and known limits. A passing source test alone does not establish a browser interaction.

[Current API reference](./reference-api) · [Documentation and evidence](./documentation) · [Interactive proof](./proof)
