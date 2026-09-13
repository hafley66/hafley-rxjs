// A bounded wheel tail: immediate input stays responsive; residual movement decays over time.
import type { GraphCamera } from "../2_graph/0_frame.js"
import { wheelCamera } from "./1_wheelCamera.js"

export type WheelImpulse = Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode" | "shiftKey" | "ctrlKey" | "metaKey">

export class WheelMomentum {
  velocityX = 0
  velocityY = 0
  at = { x: 0, y: 0 }
  event: WheelImpulse = { deltaX: 0, deltaY: 0, deltaMode: 0, shiftKey: false, ctrlKey: false, metaKey: false }
  previous = 0
  until = 0

  push(camera: GraphCamera, event: WheelImpulse, at: { x: number; y: number }, now: number): GraphCamera {
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? camera.viewport.height : 1
    // Replace velocity on every real event, including reversals and the OS's decaying scroll tail.
    this.velocityX = Math.max(-2, Math.min(2, event.deltaX * unit / 32))
    this.velocityY = Math.max(-2, Math.min(2, event.deltaY * unit / 32))
    this.event = { deltaX: 0, deltaY: 0, deltaMode: 0, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey }
    this.at = at
    this.previous = now
    this.until = now + 500
    return wheelCamera(camera, event, at)
  }

  step(camera: GraphCamera, now: number): GraphCamera | undefined {
    if (now >= this.until || Math.hypot(this.velocityX, this.velocityY) < 0.01) return undefined
    const elapsed = Math.max(0, now - this.previous)
    this.previous = now
    const decay = Math.exp(-elapsed / 85)
    const distance = 85 * (1 - decay)
    const next = wheelCamera(camera, { ...this.event, deltaX: this.velocityX * distance, deltaY: this.velocityY * distance }, this.at)
    this.velocityX *= decay
    this.velocityY *= decay
    return next
  }

  unsubscribe(): void { this.velocityX = 0; this.velocityY = 0; this.until = 0 }
}
