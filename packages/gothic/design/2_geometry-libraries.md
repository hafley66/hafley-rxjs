# Geometry library checkpoint, 2026-09-08

Requested construction vocabulary: symmetry themes including 2 through 9, circles or polygons as enclosures, open constructions, rungs, nested shapes, and geometric relationships between shape A and shape B. Pins should retain selected parameters between constructions. The theorem/construction expansion is held at this library survey; no new geometry dependency has been selected.

| Library | Runtime | Documented operations |
|---|---|---|
| [Flatten.js](https://github.com/alexbol99/flatten-js) | JavaScript with TS declarations | Points, lines, rays, segments, circles, arcs, polygons with arc edges; intersections, distances, transforms, booleans; SVG serialization |
| [Mathigon Euclid](https://mathigon.io/euclid/) | JavaScript/TypeScript | Euclidean shapes, intersections, booleans, SVG and Canvas drawing |
| [JSXGraph geometry](https://jsxgraph.org/docs/symbols/JXG.Math.Geometry.html) | JavaScript | Angle bisectors, circumcenters, projections, intersections, geometric transformations; construction objects include regular polygons and radical axes |
| [iShape](https://github.com/iShape-Rust/iShape-js) | Rust compiled to WASM | Polygon boolean operations, offsets, triangulation |
| [OpenCascade.js](https://ocjs.org/) | C++ compiled to WASM | OpenCascade CAD kernel bindings |

The existing Slice boundary accepts SVG geometry independently of its construction library. Tests cover path, circle, ellipse, rectangle, line, polyline, polygon, curves, transforms, clipping, fill restoration, and renderer-owned lifecycle. Text and referenced symbols require outline expansion before slicing.

Property animation request: per-input settings icon and keyframe table, with page/section/field inheritance. Saved base values remain separate from sampled live values. Numeric properties interpolate; discrete properties switch at keyframes. Shuffle pins retain their existing meaning.
