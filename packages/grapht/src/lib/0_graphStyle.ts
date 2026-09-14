// Shared graph colors for native primitives, document SVG, and screen-space headers.
export type GraphTheme = "light" | "dark"

/** Complete renderer-neutral palette. Spread a preset to customize individual colors. */
export type GraphStyle = {
  /** Fade uses one hue; color assigns a hue per hop. Both interpolate edge endpoint alpha. */
  hopMode?: "fade" | "color"
  canvasBackground: string
  ribbon: { fill: string; stroke: string; text: string }
  group: { fill: string; stroke: string; text: string }
  nodeBackground: string
  nodeBorder: string
  nodeText: string
  nodeOutline: string
  actorBackground: string
  actorBorder: string
  actorText: string
  lifelineBackground: string
  groupFrameBorder: string
  activationBackground: string
  activationBorder: string
  noteBackground: string
  noteBorder: string
  noteText: string
  parentBackground: string
  parentBorder: string
  edgeLine: string
  edgeText: string
  edgeTextBackground: string
  messageText: string
  messageTextBackground: string
  messageLine: string
  /** Index 0 is the hovered item; subsequent entries are hop distances. */
  hopColors?: readonly string[]
  focusBorder: string
  focusBackground: string
  headerBackground: string
  headerBorder: string
  headerText: string
}

export const GRAPH_STYLES: Readonly<Record<GraphTheme, GraphStyle>> = {
  light: {
    canvasBackground: "#fdfdfb",
    ribbon: { fill: "#E3E9FD", stroke: "#0D32B2", text: "#0A0F25" },
    group: { fill: "#EDF0FD", stroke: "#0D32B2", text: "#0A0F25" },
    nodeBackground: "#1e293b",
    nodeBorder: "#93c5fd",
    nodeText: "#f8fafc",
    nodeOutline: "#10141c",
    actorBackground: "#dbeafe",
    actorBorder: "#3b82f6",
    actorText: "#111827",
    lifelineBackground: "#64748b",
    groupFrameBorder: "#64748b",
    activationBackground: "#c4b5fd",
    activationBorder: "#8b5cf6",
    noteBackground: "#fef3c7",
    noteBorder: "#d97706",
    noteText: "#111827",
    parentBackground: "#172554",
    parentBorder: "#64748b",
    edgeLine: "#94a3b8",
    edgeText: "#f8fafc",
    edgeTextBackground: "#10141c",
    messageText: "#111827",
    messageTextBackground: "#ffffff",
    messageLine: "#475569",
    hopColors: ["#b45309", "#0369a1", "#15803d", "#c2410c", "#b91c1c"],
    focusBorder: "#fbbf24",
    focusBackground: "#eff6ff",
    headerBackground: "#172554",
    headerBorder: "#93c5fd",
    headerText: "#f8fafc",
  },
  dark: {
    canvasBackground: "#0b1220",
    ribbon: { fill: "#1e293b", stroke: "#93c5fd", text: "#e2e8f0" },
    group: { fill: "#172554", stroke: "#64748b", text: "#e2e8f0" },
    nodeBackground: "#0f172a",
    nodeBorder: "#60a5fa",
    nodeText: "#e2e8f0",
    nodeOutline: "#020617",
    actorBackground: "#1e293b",
    actorBorder: "#60a5fa",
    actorText: "#e2e8f0",
    lifelineBackground: "#475569",
    groupFrameBorder: "#64748b",
    activationBackground: "#4c1d95",
    activationBorder: "#a78bfa",
    noteBackground: "#422006",
    noteBorder: "#d97706",
    noteText: "#fde68a",
    parentBackground: "#0f172a",
    parentBorder: "#475569",
    edgeLine: "#64748b",
    edgeText: "#e2e8f0",
    edgeTextBackground: "#0b1220",
    messageText: "#e2e8f0",
    messageTextBackground: "#0b1220",
    messageLine: "#94a3b8",
    hopColors: ["#fbbf24", "#38bdf8", "#4ade80", "#fb923c", "#f87171"],
    focusBorder: "#fbbf24",
    focusBackground: "#1e293b",
    headerBackground: "#0f172a",
    headerBorder: "#64748b",
    headerText: "#e2e8f0",
  },
}

/** Both renderer resources accept the same preset name or complete caller-owned palette. */
export type GraphStyleInput = GraphTheme | GraphStyle

export interface GraphStyleResource {
  /** Recolor the current view without replacing graph geometry, camera, or source artifact. */
  applyTheme(style: GraphStyleInput): void
}

/** Resolve a preset name once at the renderer boundary. Custom palettes are read without mutation. */
export function graphStyleOf(style: GraphStyleInput): GraphStyle {
  return typeof style === "string" ? GRAPH_STYLES[style] : style
}

/** Reuse the final palette color for deeper hops; opacity still expresses increasing distance. */
export function graphHopColor(style: GraphStyle, hop: number): string {
  const colors = style.hopColors ?? []
  return colors[Math.min(colors.length - 1, Math.max(0, Math.floor(hop)))] ?? style.focusBorder
}

/** Hover paint defaults to a single hue with distance expressed through opacity. */
export function graphHoverColor(style: GraphStyle, hop: number): string {
  return graphHopColor(style, style.hopMode === "color" ? hop : 0)
}
