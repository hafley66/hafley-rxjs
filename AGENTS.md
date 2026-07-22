# JSON-RX bootstrap and authoring rules

## Bootstrap invariant

The handwritten v1 compiler emits JSON-RX documents, target lowerers, adapters,
and cross-target fixtures. Generated libraries are checked artifacts. A later
self-hosting stage uses a pinned v1 compiler to generate v2 artifacts, then
requires generated-artifact diffs and the shared fixture corpus to pass before
promotion.

The serialized graph, IR discriminants, and marble fixtures are the
compatibility record across packages and target languages.

## TypeSpec authoring

Use aliases as the primary Flow<T> authoring surface. Preserve lexical flow
references so authors do not repeat explicit dependency tuples or stream
plumbing in function calls.

Repeated author-side TypeSpec parameters are a lab trigger. First test whether
the repetition belongs in an alias function, compiler IR primitive, or target
lowerer. Keep the TypeSpec call-site surface compact until the lab establishes
the required explicit form.
