---
"@hafley66/xdom": patch
---

`data-route-boundary` ends the ancestor walk, so a component can nest inside itself.

`fromDelegatedRoute` composed every `data-route` up to the document, so a grid rendered inside
another grid's row produced the chain `g/r/g/r/c`, which equals no declared template and left both
grids receiving nothing. An element carrying `ROUTE_BOUNDARY_ATTR` now contributes its own segment
and params and stops the climb, so params below it still resolve and none above it does. An element
with no boundary above it behaves exactly as before.
