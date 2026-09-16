declare const __BEWPP_BUILD__: string

const buildId = typeof __BEWPP_BUILD__ === "undefined" ? "development" : __BEWPP_BUILD__
const channel = `bewpp-observe:${buildId}`
const state = globalThis as typeof globalThis & { bewppPageHooksBuild?: string }

if (state.bewppPageHooksBuild !== __BEWPP_BUILD__) {
  state.bewppPageHooksBuild = __BEWPP_BUILD__
  let sources = new Set<string>()

  const preview = (value: unknown) => {
    if (value === undefined) return null
    try {
      const json = JSON.stringify(value)
      return json == null ? String(value).slice(0, 16_000) : json.slice(0, 16_000)
    } catch {
      return Object.prototype.toString.call(value)
    }
  }
  const emit = (payload: Record<string, unknown>) => {
    window.postMessage(
      { channel, direction: "event", payload: { ...payload, timestamp: Date.now() } },
      location.origin === "null" ? "*" : location.origin,
    )
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.data?.channel !== channel || event.data?.direction !== "control") return
    sources = event.data.enabled && Array.isArray(event.data.sources) ? new Set(event.data.sources) : new Set()
  })

  for (const operation of ["setItem", "removeItem", "clear"] as const) {
    const original = Storage.prototype[operation] as (this: Storage, ...args: string[]) => void
    const wrapped = function (this: Storage, ...args: string[]) {
      const source = this === localStorage ? "localStorage" : this === sessionStorage ? "sessionStorage" : null
      const key = operation === "clear" ? null : String(args[0])
      const oldValue = key == null ? null : this.getItem(key)
      const result = original.apply(this, args)
      if (source && sources.has(source))
        emit({
          source,
          operation,
          key,
          oldValue,
          newValue: operation === "setItem" ? String(args[1]) : null,
        })
      return result
    }
    ;(Storage.prototype as unknown as Record<string, unknown>)[operation] = wrapped
  }

  for (const operation of ["add", "put", "delete", "clear"] as const) {
    const original = IDBObjectStore.prototype[operation] as (...args: unknown[]) => IDBRequest
    ;(IDBObjectStore.prototype[operation] as unknown) = function (this: IDBObjectStore, ...args: unknown[]) {
      const request = original.apply(this, args)
      if (sources.has("indexedDB"))
        request.addEventListener(
          "success",
          () =>
            emit({
              source: "indexedDB",
              operation,
              database: this.transaction.db.name,
              store: this.name,
              key: preview(request.result ?? args[1] ?? args[0]),
              value: operation === "add" || operation === "put" ? preview(args[0]) : null,
            }),
          { once: true },
        )
      return request
    }
  }

  // Click recording: enough context for a human or a model to name the automation target without
  // parsing the DOM, using the injected engine's own selector generator when it is installed.
  const accessibleName = (element: Element) =>
    (element.getAttribute("aria-label") || element.textContent || element.getAttribute("title") || "")
      .trim()
      .slice(0, 120)
  window.addEventListener(
    "click",
    event => {
      if (!sources.has("click")) return
      const target = event.target
      if (!(target instanceof Element)) return
      const engine = (
        globalThis as typeof globalThis & { __bewppEngine?: { selectorFor: (element: Element) => string | null } }
      ).__bewppEngine
      const candidates = [
        engine?.selectorFor(target) ?? null,
        target.id ? `#${target.id}` : null,
        target.getAttribute("data-testid") ? `[data-testid="${target.getAttribute("data-testid")}"]` : null,
        target.getAttribute("aria-label") ? `[aria-label="${target.getAttribute("aria-label")}"]` : null,
        accessibleName(target) ? `${target.tagName.toLowerCase()}:has-text("${accessibleName(target)}")` : null,
      ].filter((candidate): candidate is string => !!candidate)
      const path: { tag: string; role: string | null; name: string | null; id: string | null }[] = []
      for (let element: Element | null = target; element && path.length < 6; element = element.parentElement)
        path.push({
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute("role"),
          name: accessibleName(element),
          id: element.id || null,
        })
      emit({
        source: "click",
        operation: "click",
        playwrightSelector: engine?.selectorFor(target) ?? undefined,
        candidates,
        path,
        text: accessibleName(target),
      })
    },
    true,
  )
}
