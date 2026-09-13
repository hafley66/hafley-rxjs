# d2

`@hafley66/d2` is the d2 ingest adapter for grapht. It parses a d2 sequence source into a local
document, identifies stable occurrence ids, binds the rendered SVG back to the model, and projects
the result into the canonical `SequenceGraph`. It depends only on `@hafley66/grapht-model`; it owns
no renderer.

```
pnpm add @hafley66/d2
```

```ts
import { parseD2Sequence, d2Graph } from "@hafley66/d2"

const source = `a -> b`
const document = parseD2Sequence(source)
const graph = d2Graph(document)
```

Docs: https://hafley66.github.io/hafley-rxjs/grapht/overview
