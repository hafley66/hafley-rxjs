import { flushSync } from "react-dom"

type Doc = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }

let armed = false
// a transition on the very first paint hangs the load, so the app arms this after its first commit
export const armTransitions = (): void => {
  armed = true
}

export function transition(update: () => void): void {
  const doc = document as Doc
  if (!armed || typeof doc.startViewTransition !== "function") {
    update()
    return
  }
  doc.startViewTransition(() => flushSync(update))
}
