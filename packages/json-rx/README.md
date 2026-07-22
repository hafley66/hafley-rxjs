# @hafley66/json-rx

JSON Schema-defined RxJS automation documents, a typed runtime compiler, a
TypeSpec authoring path, and a generated React form editor.

The current document contract is `automation.v1`. Flows may use ordered pipes
or nested expressions. Ordered pipes are the default authoring form.

## Install

From the `hafley-rxjs` workspace:

```bash
pnpm install
```

From another local pnpm workspace:

```json
{
  "dependencies": {
    "@hafley66/json-rx": "link:../hafley-rxjs/packages/json-rx"
  }
}
```

The package expects React 19 and RxJS 7.8 as peer dependencies.

## JSON editor support

Add `$schema` to an automation document:

```json
{
  "$schema": "./node_modules/@hafley66/json-rx/automation.schema.json",
  "version": "automation.v1",
  "profile": "rxjs-7.8"
}
```

The schema is exported as:

```text
@hafley66/json-rx/automation.schema.json
```

## Document shape

An automation binds host event sources, declares a circuit, and connects flows
to outputs:

```json
{
  "$schema": "./node_modules/@hafley66/json-rx/automation.schema.json",
  "version": "automation.v1",
  "profile": "rxjs-7.8",
  "id": "example.usage",
  "enabled": true,
  "bindings": {
    "sources": {
      "usage.responses": {
        "kind": "http.event",
        "page": { "host": "example.com" },
        "request": { "methods": ["GET"], "url": "/api/usage" }
      }
    }
  },
  "circuit": {
    "sources": {
      "usage.responses": {}
    },
    "reducers": {},
    "flows": {
      "usage": {
        "pipe": [
          {
            "node": "usage.source",
            "source": { "$ref": "usage.responses" }
          },
          {
            "node": "usage.map",
            "map": {
              "from": "$.body",
              "language": "jsonata",
              "fields": { "utilization": "utilization" }
            }
          },
          {
            "node": "usage.share",
            "shareReplay": { "bufferSize": 1, "refCount": true }
          }
        ]
      }
    }
  },
  "outputs": [
    {
      "kind": "host.emit",
      "flow": "usage",
      "stream": "example.usage",
      "schema": { "type": "object", "additionalProperties": true }
    }
  ]
}
```

Source and reducer edges use `{ "$ref": "address" }`. Output `flow` fields
refer to keys in `circuit.flows`.

## Validate a document

```ts
import { AutomationSchema, type Automation } from '@hafley66/json-rx'

const automation: Automation = AutomationSchema.parse(input)
```

`AutomationSchema` validates document fields, unique node IDs, source and
reducer references, host bindings, pipe ordering, and output flow references.

## Compile a runtime

Supply an RxJS observable for every source address:

```ts
import { compileAutomation } from '@hafley66/json-rx'
import { of } from 'rxjs'

const runtime = compileAutomation(document, {
  'usage.responses': of({
    method: 'GET',
    pageUrl: 'https://example.com/usage',
    requestUrl: 'https://example.com/api/usage',
    status: 200,
    ts: Date.now(),
    body: { utilization: 42 },
  }),
})

const subscription = runtime.roots['example.usage'].subscribe((emission) => {
  console.log(emission)
})

subscription.unsubscribe()
```

Each output stream appears in `runtime.roots` under its configured `stream`
name. Runtime compilation parses the document before constructing its RxJS
graph.

## React form editor

```tsx
import { JsonRxForm } from '@hafley66/json-rx'
import { useState } from 'react'

export function AutomationEditor({ initialValue }: { initialValue: unknown }) {
  const [value, setValue] = useState(initialValue)

  return (
    <JsonRxForm
      value={value}
      onChange={setValue}
      onSubmit={(automation) => console.log(automation)}
    />
  )
}
```

The form is generated from the automation JSON Schema through RJSF and Material
UI. Operator variants and document references are presented as selections.
Saving is enabled after the controlled value passes `AutomationSchema`.

## TypeSpec authoring

The TypeSpec authoring surface uses aliases over `automation`, `source`, `map`,
and `output` functions:

```typespec
import "../../4_typespec/4a_aliasFunctions.tsp";

using JsonRx;

namespace Automations.Example;

alias example = automation("example.usage", "example.com");
alias responses = source(example, "usage.responses", "/api/usage", #["GET"]);
alias usage = map(responses, "usage", "$.body", #{
  utilization: "utilization",
});
alias dashboard = output(usage, "example.usage");
```

The current compiler slice is
[`src/5_automations/0_claude_usage/0_input.tsp`](src/5_automations/0_claude_usage/0_input.tsp).
Generation produces:

```text
1_document.auto.ts
2_document.snapshot.json
```

Generated TypeScript files carry the `.auto.ts` suffix and a generated header.
Edit the TypeSpec input and run generation instead of editing those files.

## Commands

From the repository root:

```bash
pnpm generate
pnpm generate:check
pnpm check:json-rx
```

From `packages/json-rx`:

```bash
pnpm typespec:check  # compile the TypeSpec vocabulary
pnpm generate        # regenerate schema, document module, and JSON snapshot
pnpm generate:check  # detect stale artifacts and missing generated headers
pnpm typecheck       # check TypeScript
pnpm test            # run Node and Chromium browser tests
pnpm build           # build JavaScript, declarations, and JSON Schema
pnpm check           # run every package gate
```

## Source layout

```text
spec/                   TypeSpec vocabulary
src/0_types.ts          runtime event and output types
src/1_schema.ts         Zod contract and JSON Schema generation
src/2_runtime.ts        RxJS compiler
src/3_editor/           generated-schema React editor
src/4_typespec/         alias functions, semantic graph, and emitter
src/5_automations/      authored slices and generated artifacts
scripts/                generation and generated-file checks
plans/                  implementation plans
```
