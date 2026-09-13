# mmd

`@hafley66/mmd` is the mermaid ingest adapter for grapht. It parses a mermaid sequence source into
a local document, identifies stable occurrence ids, binds the rendered SVG back to the model, and
projects the result into the canonical `SequenceGraph`. Rendering runs through `mermaid` and
`playwright`; the durable model stays in `@hafley66/grapht-model`.

```
pnpm add @hafley66/mmd
```

```ts
import { parseMermaidSequence, mermaidGraph } from "@hafley66/mmd"

const source = `sequenceDiagram\n  a->>b: hello`
const document = parseMermaidSequence(source)
const graph = mermaidGraph(document)
```

Docs: https://hafley66.github.io/hafley-rxjs/grapht/overview
