// Cytoscape-compatible primitive rules are the shared style floor for canvas and SVG adapters.
import type { GraphStyle } from "./0_graphStyle.js"
export type GraphStyleRule = { selector: string; style: Record<string, unknown> }

/** Native Cytoscape consumes these rules directly. SVG maps supported primitive paint properties. */
export function graphStylesheet(c: GraphStyle): GraphStyleRule[] {
  return [
    { selector: "node", style: { label: "data(label)", backgroundColor: c.nodeBackground, borderColor: c.nodeBorder, borderWidth: 1, color: c.nodeText, fontSize: 12, textOutlineColor: c.nodeOutline, textOutlineWidth: 2 } },
    { selector: "node[width][height]", style: { width: "data(width)", height: "data(height)" } },
    { selector: "node[nativeKind = 'actor-shape']", style: { shape: "roundrectangle", backgroundColor: c.actorBackground, borderColor: c.actorBorder, color: c.actorText, textOutlineWidth: 0, textHalign: "center", textValign: "center" } },
    { selector: "node[nativeKind = 'lifeline']", style: { shape: "rectangle", backgroundColor: c.lifelineBackground, borderWidth: 0 } },
    { selector: "node[nativeKind = 'group-frame']", style: { shape: "rectangle", backgroundOpacity: 0.04, borderColor: c.groupFrameBorder } },
    { selector: "node[nativeKind = 'group-label']", style: { shape: "rectangle", backgroundOpacity: 0, borderWidth: 0, textHalign: "center", textValign: "center" } },
    { selector: "node[nativeKind = 'activation']", style: { shape: "rectangle", backgroundColor: c.activationBackground, borderColor: c.activationBorder } },
    { selector: "node[nativeKind = 'note-shape']", style: { shape: "rectangle", backgroundColor: c.noteBackground, borderColor: c.noteBorder, color: c.noteText, textOutlineWidth: 0, textHalign: "center", textValign: "center" } },
    { selector: "node:parent", style: { backgroundColor: c.parentBackground, backgroundOpacity: 0.38, borderColor: c.parentBorder, borderWidth: 1, padding: 24 } },
    { selector: "edge", style: { label: "data(label)", curveStyle: "bezier", lineColor: c.edgeLine, targetArrowColor: c.edgeLine, sourceArrowColor: c.edgeLine, color: c.edgeText, fontSize: 12, textBackgroundColor: c.edgeTextBackground, textBackgroundOpacity: 0.86, textBackgroundPadding: 2 } },
    { selector: ".graph-sealed-root", style: { opacity: 0, events: "no" } },
    { selector: ".graph-endpoint-anchor", style: { width: "data(width)", height: "data(height)", opacity: 0 } },
    { selector: ".graph-route-endpoint", style: { width: 1, height: 1, opacity: 0 } },
    { selector: ".graph-native-message", style: { curveStyle: "straight", color: c.messageText, textBackgroundColor: c.messageTextBackground, lineColor: c.messageLine, targetArrowColor: c.messageLine, width: 1, zIndex: 3, zIndexCompare: "manual" } },
    { selector: ".graph-native-segments", style: { curveStyle: "segments", segmentWeights: "data(segmentWeights)", segmentDistances: "data(segmentDistances)", edgeDistances: "node-position" } },
    { selector: ".graph-group-frame", style: { zIndex: 0, zIndexCompare: "manual" } },
    { selector: ".graph-lifeline", style: { zIndex: 1, zIndexCompare: "manual" } },
    { selector: "edge[direction = 'forward']", style: { targetArrowShape: "triangle" } },
    { selector: "edge[direction = 'both']", style: { sourceArrowShape: "triangle", targetArrowShape: "triangle" } },
    { selector: "node.graph-focused", style: { borderColor: c.focusBorder, borderWidth: 3, backgroundColor: c.focusBackground } },
    { selector: "edge.graph-focused", style: { lineColor: c.focusBorder, targetArrowColor: c.focusBorder, sourceArrowColor: c.focusBorder, width: 3 } },
    { selector: ".graph-source-label", style: { backgroundOpacity: 0, borderWidth: 0, textOutlineWidth: 0, textWrap: "wrap", textMaxWidth: "data(width)", textOverflowWrap: "anywhere", fontSize: "data(fontSize)", textHalign: "center", textValign: "center", zIndex: 5, zIndexCompare: "auto" } },
    { selector: ".graph-hidden", style: { display: "none" } },
  ]
}
