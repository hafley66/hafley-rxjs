// The React surface, and the whole of it: `renderMarbles` already returns an effect's contract, so
// this adapter is the effect and nothing else. No hook wraps a signal, no component subscribes.
import { type CSSProperties, createElement, type ReactElement, useEffect, useRef } from "react"
import type { MarbleDoc } from "./0_types.js"
import { createMarblePlayer, type MarblePlayer } from "./4_player.js"
import { renderMarbles } from "./5_render.js"

export type MarbleDiagramProps = {
  readonly player: MarblePlayer
  readonly className?: string
  readonly style?: CSSProperties
}

/**
 * Mounts a player. The player is the identity: pass the same one across renders and the DOM is
 * never rebuilt, which is the only way to keep the playhead from resetting on every parent render.
 */
export function MarbleDiagram({ player, className, style }: MarbleDiagramProps): ReactElement {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = host.current
    if (element === null) return
    return renderMarbles(player, element).unsubscribe
  }, [player])
  return createElement("div", { ref: host, className, style })
}

/**
 * A player owned by the component that calls this. The allocation is stable across renders and
 * StrictMode's double render, and a player holds nothing until something reads it, so a second
 * allocation is harmless.
 */
export function useMarblePlayer(doc: MarbleDoc): MarblePlayer {
  const held = useRef<MarblePlayer | null>(null)
  if (held.current === null) held.current = createMarblePlayer(doc)
  const player = held.current
  // A new document is a write, not a stream to connect: it goes on the commit, and `load` is
  // idempotent so the double commit StrictMode makes changes nothing.
  useEffect(() => {
    player.load(doc)
  }, [player, doc])
  return player
}

export { createMarblePlayer }
export type { MarblePlayer }
