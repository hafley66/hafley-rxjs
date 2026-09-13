# Frame, geometry, and the camera

- [What a GraphFrame is](#what-a-graphframe-is)
- [The camera convention](#the-camera-convention)
- [The wrong camera is the common defect](#the-wrong-camera-is-the-common-defect)
- [fitGraphCamera](#fitgraphcamera)
- [Geometry](#geometry)

## What a GraphFrame is

`GraphFrame` is the whole renderable state of a diagram at one instant: the graph, its geometry, the
camera, and the presentation. Declared at `packages/grapht/src/2_graph/0_frame.ts:45`.

| field | type | declared at | carries |
| --- | --- | --- | --- |
| `graph` | `Graph` | `src/2_graph/0_frame.ts:46` | the model |
| `geometry` | `GraphGeometry` | `src/2_graph/0_frame.ts:5` | bounds, routes, headers |
| `camera` | `GraphCamera` | `src/2_graph/0_frame.ts:16` | pan and zoom |
| `presentation` | `GraphPresentation` | `src/2_graph/0_frame.ts:35` | sticky headers, hidden and focused ids, labels, sealed artifacts |

A renderer never reads the model for position. It reads `geometry` and `camera` together to place
each node on screen, and `presentation` to decide what is hidden, stuck, or focused.

## The camera convention

`GraphCamera` is three fields plus the viewport (`src/2_graph/0_frame.ts:16`):

```ts
type GraphCamera = { x: number; y: number; scale: number; viewport: Rect }
```

The mapping from content space to screen space is exactly:

```
screenX = contentX * scale + camera.x
screenY = contentY * scale + camera.y
```

`scale` multiplies content coordinates, so it is zoom. `x` and `y` are a translation added after
that multiplication, so they are pan measured in screen pixels, not content units. Zoom does not
change `x` or `y`; pan does not change `scale`.

The sticky layers depend on this same spelling: `item.left * camera.scale + camera.x` at
`packages/grapht-model/src/5a_stickyRibbon.ts:49` and `naturalTop * camera.scale + camera.y` at
`packages/grapht/src/2_graph/6_stackGroupHeaders.ts:69`. A renderer that applies `x` and `y` before
`scale`, or treats `x`/`y` as content offsets, disagrees with both and breaks the sticky math.

## The wrong camera is the common defect

A camera built the wrong way renders correctly at `scale: 1` and quietly drifts at every other
zoom. The tell is that sticky headers, which are pure screen-space math, no longer line up with the
columns they label once you zoom in.

```ts
// right: scale the content, then translate in screen pixels
const screenX = contentX * camera.scale + camera.x

// wrong: translate in content units, then scale the pan
const screenX = (contentX + camera.x) * camera.scale
```

The second form makes the pan distance grow with zoom, so dragging the canvas while zoomed in moves
it far more than the pointer did.

## fitGraphCamera

`fitGraphCamera(geometry, viewport, padding)` computes a camera that fits every declared bounds,
header, and route point into the viewport with a screen-space padding
(`packages/grapht/src/2_graph/1_fitCamera.ts:41`). It returns the camera as above: `scale` from the
tightest fit axis (`src/2_graph/1_fitCamera.ts:64`), then `x`/`y` that center the content in screen pixels
(`src/2_graph/1_fitCamera.ts:69`).

Call it on every geometry change, not once at mount. A camera fitted to stale geometry pins a
diagram that has since grown, and the sticky headers keep agreeing with the stale pan.

## Geometry

`GraphGeometry` carries the revision id, per-id bounds and endpoint anchors, edge routes, and header
bounds (`src/2_graph/0_frame.ts:5`). The `revisionId` is the compatibility record: geometry captured under one
revision is replayed without a live layout engine, which is what lets a sealed SVG artifact stay
immutable while the diagram scrolls.
