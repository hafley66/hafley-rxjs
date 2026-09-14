import { graphHoverColor, type GraphStyle } from "./0_graphStyle.js"
import { hoverOpacity } from "../2_graph/16_neighborhood.js"

/** Logical endpoints determine paint even when a renderer uses separate route anchor nodes. */
export function hoverEdgeStops(style: GraphStyle, hops: Readonly<Record<string, number>>, fromId: string, toId: string) {
  return [fromId, toId].map(id => ({
    color: hops[id] === undefined ? style.messageLine : graphHoverColor(style, hops[id]),
    opacity: hoverOpacity(hops[id], Object.keys(hops).length > 0),
  }))
}
