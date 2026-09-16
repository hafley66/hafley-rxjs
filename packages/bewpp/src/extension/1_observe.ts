import type {
  DomCommand,
  ObservationBatch,
  ObservationOptions,
  ObservationSource,
  PageObservationEvent,
} from "../0_controls.js"

declare const __BEWPP_BUILD__: string

const buildId = typeof __BEWPP_BUILD__ === "undefined" ? "development" : __BEWPP_BUILD__
const channel = `bewpp-observe:${buildId}`
let active = false
let options: Required<ObservationOptions> | null = null
let observer: MutationObserver | null = null
let debounce: ReturnType<typeof setTimeout> | null = null
let sequence = 0
let dropped = 0
let events: PageObservationEvent[] = []

function append(event: Omit<PageObservationEvent, "sequence">) {
  if (!active || !options?.sources.includes(event.source)) return
  events.push({ ...event, sequence: ++sequence })
  if (events.length > options.maxEvents) {
    const excess = events.length - options.maxEvents
    events.splice(0, excess)
    dropped += excess
  }
}

function setPageHooks(enabled: boolean, sources: ObservationSource[] = []) {
  window.postMessage(
    { channel, direction: "control", enabled, sources },
    location.origin === "null" ? "*" : location.origin,
  )
}

function snapshotDom() {
  debounce = null
  if (!active || !options?.sources.includes("dom")) return
  const root = document.querySelector<HTMLElement>(options.selector)
  append({
    timestamp: Date.now(),
    source: "dom",
    selector: options.selector,
    text: root?.innerText.slice(0, options.textLimit) ?? "",
  })
}

function startDomObserver() {
  observer?.disconnect()
  observer = null
  if (!options?.sources.includes("dom")) return
  const root = document.querySelector(options.selector)
  if (!root) throw new Error(`Observation selector did not match: ${options.selector}`)
  observer = new MutationObserver(() => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(snapshotDom, options?.debounceMs)
  })
  observer.observe(root, { subtree: true, childList: true, characterData: true })
}

window.addEventListener("message", event => {
  if (event.source !== window || event.data?.channel !== channel || event.data?.direction !== "event") return
  const payload = event.data.payload as Omit<PageObservationEvent, "sequence"> | undefined
  if (!payload || !["localStorage", "sessionStorage", "indexedDB"].includes(payload.source)) return
  const eventValue = options?.includeValues
    ? payload
    : {
        ...payload,
        oldValue: undefined,
        newValue: undefined,
        value: undefined,
      }
  append(eventValue)
})

function batch(afterSequence = sequence, limit = 100): ObservationBatch {
  const selected = events.filter(event => event.sequence > afterSequence).slice(0, limit)
  return {
    active,
    events: selected,
    cursor: selected.at(-1)?.sequence ?? afterSequence,
    oldestSequence: events[0]?.sequence ?? null,
    newestSequence: events.at(-1)?.sequence ?? null,
    dropped,
    hasMore: events.some(event => event.sequence > (selected.at(-1)?.sequence ?? afterSequence)),
  }
}

export function executeObservation(command: Extract<DomCommand, { op: "observe" }>): ObservationBatch {
  if (command.action === "start") {
    const selector = command.selector ?? "body"
    if (command.sources.includes("dom") && !document.querySelector(selector))
      throw new Error(`Observation selector did not match: ${selector}`)
    observer?.disconnect()
    if (debounce) clearTimeout(debounce)
    active = true
    sequence = 0
    dropped = 0
    events = []
    options = {
      sources: [...new Set(command.sources)],
      selector,
      includeValues: command.includeValues ?? false,
      debounceMs: command.debounceMs ?? 250,
      maxEvents: command.maxEvents ?? 500,
      textLimit: command.textLimit ?? 12_000,
    }
    startDomObserver()
    setPageHooks(true, options.sources)
    return batch(0)
  }
  if (command.action === "stop") {
    active = false
    observer?.disconnect()
    observer = null
    if (debounce) clearTimeout(debounce)
    debounce = null
    setPageHooks(false)
    return batch(0)
  }
  return batch(command.afterSequence ?? 0, command.limit ?? 100)
}
