# @hafley66/md

## Unreleased

### Minor Changes

- Route `sequenceDiagram` mermaid fences and `shape: sequence_diagram` d2 fences through
  `@hafley66/grapht`: the rendered SVG is bound by the language adapter, ingested as a sealed
  grapht frame, and mounted through `@hafley66/grapht-render-cytoscape` with the dark/light
  palette applied. Every other mermaid and d2 fence keeps the existing `MermaidDiagram` and
  `D2Diagram` path.

## 0.1.0

### Minor Changes

- Publish the sectioned Markdown viewer with folding, navigation, Mermaid and D2 rendering, diagram lightboxes, and host integration ports.
