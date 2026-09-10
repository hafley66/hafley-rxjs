# Density

Change how tall every row is with one write, and let per-row overrides keep their own heights.

<GridDemo id="density" />

## The state

```ts
g.state.density.$("compact")
g.state.density.$("standard")
g.state.density.$("comfortable")
```

Three named settings resolve to three pixel values. The resolution happens in the property writer,
so the state key stays a name and the stylesheet holds the numbers.

## What it writes

`writeGridVars` in `src/9_css.ts` sets the row height custom property on the grid root from the
density key, once per frame. Everything sized in row heights follows from that single property,
including the scroll spacer and the windowed run's translate.

## Density against per-row height

A row carrying its own height in `state.rowHeight` keeps it, because the override is a property
named after that row and the density value is the fallback the generic rule reads. Overrides are on
[Height](/rows-height).

## Cost of a density change

The row height is the sizer's input, so a density write re-derives the window and moves the plan.
That is one derivation over the page run rather than a re-layout of the document, and the renderer
repaints the run it already has.

## Setting it yourself

Nothing stops a stylesheet writing the property directly.

```css
.dense-grid { --sg-row-h: 24px; }
```

The state key exists so the value is readable, persistable, and reachable from a control, which a
class name is not. Restyling through properties in general is on [Theming](/view-theme).
