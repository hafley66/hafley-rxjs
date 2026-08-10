# @hafley66/path

Typed path templates, value access, and signal-seam routes.

> **Authorship attestation:** This README was written by Claude (AI). No human
> has verified it against the source. Treat the examples as unverified until you
> run them, and check signatures against `src/` before depending on them.

📚 **[Full API Documentation](https://hafley66.github.io/hafley-rxjs/)**

---

## Install

```sh
npm install @hafley66/path zod
```

---

## Path templates

A factory per syntax. `/` segments, `?` query, `&` entries, `#` pointer.

```ts
import { slash, dots, fileLocator } from "@hafley66/path"

const user = slash("/users/{userId}?{tab}")

user.template        // "/users/{userId}?{tab}"
user.parts           // [{kind:"literal",value:"users"}, {kind:"property",name:"userId"}]
user.print({ userId: "a b", tab: "details" })  // "/users/a%20b?tab=details"
user.match("/users/42?tab=edit")
// { matched: true, values: { userId: "42", tab: "edit" } }
user.match("/nope")
// { matched: false, reason: "structure" }
```

Segment forms: `{name}` property, `{name?}` optional, `{name*}` rest, `:name`
shorthand. `ValuesOf<Template>` infers the value shape from the template string.

---

## `route` — typed path params (zod)

A route declares a path template with scalar-typed params, a zod query schema,
and a zod payload schema in one call. Path param types are inferred from the
template literal — never restated.

```ts
import { route, NumberPathParam, BooleanPathParam } from "@hafley66/path"
import * as z from "zod"

const Changed = route(
  `/panel/${NumberPathParam("id")}/flagged/${BooleanPathParam("on")}`,
  z.object({ revision: z.coerce.number(), view: z.enum(["graph", "table"]).optional() }),
  z.object({ changed: z.boolean(), rows: z.array(z.string()) }),
)
```

The path params infer as `number` and `boolean` from `{number:id}` /
`{boolean:on}`. The combined input type is everything; the URL output type omits
payload keys.

```ts
Changed.href({ id: 42, on: true, revision: 7, changed: true, rows: ["a"] })
// "/panel/42/flagged/true?revision=7"

Changed.match("/panel/42/flagged/true?revision=7")
// { matched: true, values: { id: 42, on: true, revision: 7 } }
// payload keys (changed, rows) are not in the URL and not in match's output

Changed.match("/panel/forty-two/flagged/true?revision=7")
// { matched: false, reason: "values" }   — "forty-two" is not a number
```

Helpers: `NumberPathParam(name)`, `StringPathParam(name)`, `BooleanPathParam(name)`.
Each emits the `{scalar:name}` token and brands its literal type.

The route owns no Signal. The caller attaches one at the seam:

```ts
const events = Signal<z.infer<typeof Changed.schema>>()   // @hafley66/signals
events.$(Changed.schema.parse({ id: 1, on: true, revision: 1, changed: true, rows: [] }))
```

---

## Composition

```ts
const org = slash("/orgs/{orgId}")
const repo = slash("/{repoId}")
const full = org.concatenate(repo)   // "/orgs/{orgId}/{repoId}"
full.print({ orgId: "o", repoId: "r" })  // "/orgs/o/r"
```

`concatenate` merges value shapes and rejects conflicting param names at the type level.

---

## Pattern adapters

Render a template to a framework's own syntax.

```ts
toReactRouterPattern(slash("/users/{userId}?{tab}"))  // "/users/:userId"
toTanStackPattern(slash("/users/{userId}"))           // "/users/$userId"
toOpenApiPattern(slash("/users/:userId"))             // "/users/{userId}"
```

---

## Build / test

```sh
pnpm typecheck   # tsc --noEmit
pnpm test        # tsc build, then node --test test/*.test.mjs
```
