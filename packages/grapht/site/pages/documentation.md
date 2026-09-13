# Documentation and evidence

Read the behavior first, then open the implementation evidence when needed. Proposed work carries a visible status label and separate acceptance checks.

## Page shape for a new user

1. **Outcome:** what the user can do, in one sentence.
2. **Example:** one executable example using released exports, or a clearly labelled proposed interaction.
3. **Contract:** inputs, resulting state, lifetime, and who owns persistence.
4. **Evidence:** source and fixture links; recorded results include command and revision.
5. **Limits:** unsupported behavior and the decisions still open.

For neighbor highlighting, the proposed introduction is: “Select a node to inspect its callers and dependencies. Hover previews the selection. Nearby hops stay bright; more distant hops fade.” The feature-status page links the existing traversal and the remaining renderer work. An executable usage example belongs here after the public API and its fixture exist.

## Source of truth

| Content | Authoring location | Generated output |
| --- | --- | --- |
| Module purpose | First sentence of the module's leading line comment | API module table and section introduction |
| Export behavior | JSDoc beside the exported declaration | API prose beside its signature |
| Types and signatures | TypeScript declarations and compiler checker | API signature blocks |
| Public scope and reading order | grapht API generator's module list and barrel | Ordered module/export reference |
| Site navigation | Site content tree | VitePress sidebar, routes, page allow-list |
| Proposed work | Canonical plan files | Proposed-work pages with public source links |
| Task guide and implementation argument | Authored guide or plan | Short narrative with links to contracts and evidence |

The current generator consumes module-header prose and JSDoc summaries. It does not promise automatic rendering of every custom documentation tag. Guides supply the user task and the reasoning that declarations cannot express.

## Comment contract

For a new or changed public module, write a leading sentence describing its behavior. For a new or changed export, put the behavioral contract in adjacent JSDoc: inputs/outputs, mutation or identity rules, resource lifetime, and important exclusions. Keep signatures in code; the generator reads them. Lifecycle teardown is named unsubscribe.

Examples in guides return composed streams to the application boundary. They must use actual exported APIs. Proposed examples and signatures remain visibly marked as sketches until implemented.

The frame, translation, and renderer modules demonstrate this convention. Existing modules can adopt it as they change; this page does not claim a completed documentation audit of every export.

## Build and review

The site content step regenerates the plans and API, checks documentation citations/exports, and renders the pages before VitePress builds. A docs-lint failure stops the build. Generated plan pages link to their canonical source; edit that source instead of the generated copy.

Keep arguments attached to decisions: requirement, existing capability, gap, selected behavior, alternatives or unresolved choice, and the observation that will decide acceptance. Keep performance claims tied to a reproducible measurement. A source link is evidence of implementation, a test result is evidence of the tested conditions, and a browser receipt is evidence of the exercised interaction.

Sources: [API generator](https://github.com/hafley66/hafley-rxjs/blob/main/packages/docs-kit/scripts/api.mjs), [docs checker](https://github.com/hafley66/hafley-rxjs/blob/main/packages/docs-kit/scripts/docs.mjs), [site content tree](https://github.com/hafley66/hafley-rxjs/blob/main/packages/grapht/site/content.ts), [plan publisher](https://github.com/hafley66/hafley-rxjs/blob/main/packages/grapht/scripts/6_plans.mjs).
