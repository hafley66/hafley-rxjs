# Where the API reference comes from

## Contents

- [The question](#the-question)
- [The two hard constraints](#the-two-hard-constraints)
- [Candidates](#candidates)
- [The number that decided it](#the-number-that-decided-it)
- [What was built instead](#what-was-built-instead)
- [When to revisit](#when-to-revisit)

## The question

Four documents in `packages/signal-grid` once reported four different unit-test counts, and several
pages cited exports that no longer existed. `scripts/docs.mjs` was written to fail on that drift.
An API reference typed by hand is the largest remaining surface where the same drift can start, so
the reference should be read out of the TypeScript program.

Buying beats building when a library covers the shape. This is the written comparison.

## The two hard constraints

| constraint | where it comes from | what it disqualifies |
| --- | --- | --- |
| one TypeScript in the tree, pinned at 7.0.2 | `package.json` devDependencies; the owner refused a second copy when twoslash asked for one | anything needing a 5.x or 6.x compiler |
| output has to pass `node packages/signal-grid/scripts/docs.mjs` | a lint people skip is a lint that does nothing | any emitter whose markdown carries citations it cannot keep accurate |

## Candidates

Downloads read on 2026-09-10 from `https://api.npmjs.org/downloads/point/last-week/<name>`.
Versions and licences read from `https://registry.npmjs.org/<name>`.

| name | version | licence | weekly downloads | last release | output | VitePress-ready markdown | the one reason it loses |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `typedoc` | 0.28.20 | Apache-2.0 | 2,636,829 | 2026-07-05 | HTML, or markdown through a plugin | through `typedoc-plugin-markdown` | peer range is `5.0.x` through `6.0.x`; against the pinned 7.0.2 it throws before it reads a file |
| `typedoc-plugin-markdown` | 4.13.0 | MIT | 1,650,963 | 2026-08-25 | markdown | yes, with a VitePress preset | peers `typedoc@0.28.x`, so it inherits TypeDoc's compiler range exactly |
| `@microsoft/api-extractor` | 7.59.1 | MIT | 2,468,781 | 2026-09-09 | `.api.json` plus a rolled-up `.d.ts` | no, it emits a model | ships `typescript@5.9.3` as a direct dependency, which is the second compiler in the tree the owner refused |
| `@microsoft/api-documenter` | 7.30.14 | MIT | 82,273 | 2026-09-09 | markdown from an `.api.json` | close, one file per member, needs a nav shim | only reads what api-extractor wrote, so it inherits that disqualifier and adds a two-step pipeline |
| `extract` (this workspace's own) | 0.1.0, `~/.cargo/bin/extract` | in-repo | not published | built 2026-09-09 | JSONL facts, or SQLite tables | no, facts are not a page | `--family scip` on a TypeScript root shells out to `scip-typescript`, which bundles its own compiler; and a markdown layer would still have to be written on top of `scip_def` and `scip_name` |
| `typescript/unstable/sync` | 7.0.2, already installed | Apache-2.0 | the compiler itself | pinned | a program, a checker, and symbols | no, a renderer has to be written | it is an API rather than a generator, so roughly 200 lines of rendering are the cost of using it |

## The number that decided it

TypeDoc and its markdown plugin were the strongest buy. They are also the ones that do not run:

```
$ npx typedoc
node_modules/.pnpm/typedoc@0.28.15_typescript@7.0.2/node_modules/typedoc/dist/lib/converter/comments/discovery.js:9
    ts.SyntaxKind.PropertyDeclaration,
                  ^
TypeError: Cannot read properties of undefined (reading 'PropertyDeclaration')
```

TypeScript 7 moved the compiler off the single `ts` namespace object every 5.x consumer reaches
through. TypeDoc reads `ts.SyntaxKind` at module load, gets `undefined`, and throws before it has
opened a source file. Satisfying it means installing a second TypeScript, which is the thing this
repository already declined once.

api-extractor loses for the same reason one step earlier: `typescript@5.9.3` is not a peer it will
accept a substitute for, it is a direct dependency it installs.

## What was built instead

`packages/docs-kit/scripts/api.mjs`, on `typescript/unstable/sync`, which `scripts/docs.mjs`
already uses for its export check. Three calls carry the whole thing:

| call | what it answers |
| --- | --- |
| `checker.getExportsOfModule(barrelSymbol)` | which names are public |
| `checker.getExportsOfModule(moduleSymbol)` | which module declares each one |
| `checker.getTypeOfSymbol(symbol)` plus `typeToString` | the resolved signature, generics and all |
| `checker.getDocumentationCommentOfSymbol(symbol)` | the prose already written beside the code |

Two rules keep the output inside the lint rather than beside it. Every signature sits in a fenced
block, where the lint's backtick spans find nothing to check. Every citation is placed by the same
`declarationLine` rule `scripts/docs.mjs` uses to verify one, so the generator and the lint cannot
disagree about which line a symbol is on.

## When to revisit

Two things would change the answer. TypeDoc shipping a 7.x peer range makes it the better buy,
since it also renders inherited members, type parameter constraints and cross-links that this
generator does not. A second package in the workspace needing a reference shape this one cannot
produce is the other, and that is the point at which buying beats another two hundred lines.
