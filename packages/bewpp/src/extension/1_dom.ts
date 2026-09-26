import {
  fireEvent,
  queryAllByLabelText,
  queryAllByPlaceholderText,
  queryAllByRole,
  queryAllByTestId,
  queryAllByText,
  waitFor,
} from "@testing-library/dom"
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event"
import type { DomCommand, ImageAsset, LocatorQuery } from "../0_controls.js"
import { LOCATOR_TIMEOUT_MS, oneElementMessage } from "../0_controls.js"
import { playwrightSelector } from "../0_selectors.js"
import { bundledEngine } from "./0_engine.js"
import { executeObservation } from "./1_observe.js"

const visible = (element: Element) =>
  !!element.getClientRects().length &&
  getComputedStyle(element).visibility !== "hidden" &&
  !element.closest("[hidden], [inert]")
const disabled = (element: Element) => element.matches(":disabled") || element.getAttribute("aria-disabled") === "true"

/**
 * The elements the injected engine tagged for one resolution, in the engine's own order. The engine runs
 * in the main world and this content script runs in the isolated world, so the marker attribute is the
 * only handle the two share.
 */
function markedElements(marker: string): HTMLElement[] {
  const hit = (element: Element) => Number((element.getAttribute("data-bewpp-hit") ?? "").split("-").pop() ?? 0)
  const found: HTMLElement[] = []
  const visit = (root: Document | ShadowRoot | Element) => {
    if (root instanceof Element && root.matches(`[data-bewpp-hit^="${marker}-"]`)) found.push(root as HTMLElement)
    for (const element of root.querySelectorAll<HTMLElement>(`[data-bewpp-hit^="${marker}-"]`)) found.push(element)
    for (const element of root.querySelectorAll<HTMLElement>("*")) if (element.shadowRoot) visit(element.shadowRoot)
  }
  visit(document)
  return found.sort(
    (left, right) => hit(left) - hit(right),
  )
}

/** The CLI clips page text to its token budget and `bew x` pages the rest; this bounds only the transfer. */
const INSPECT_TEXT_MAX = 200_000
/** Enough to carry a post's outbound links without dragging in a page's whole navigation. */
const BLOCK_LINKS_MAX = 12

const squash = (text: string) => text.replace(/\s+/g, " ").trim()

/** Attributes short enough to label a block, e.g. shreddit-comment's author and score. */
const LABEL_ATTRIBUTE_MAX = 40
const UNLABELLING_ATTRIBUTES = new Set(["class", "style", "id", "slot", "tabindex", "lang", "dir", "role"])

/**
 * Each element's own text: text inside a nested matched element belongs to that element, so a comment
 * thread yields one block per comment instead of every ancestor repeating its replies.
 */
function blocks(elements: HTMLElement[]) {
  const matched = new Set<Element>(elements)
  const owner = (node: Node) => {
    let at = node.parentElement
    while (at && !matched.has(at)) at = at.parentElement
    return at
  }
  return elements.map(element => {
    const parts: string[] = []
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement
      if (owner(node) === element && !parent?.closest("script, style, noscript")) parts.push(node.textContent ?? "")
    }
    const links: string[] = []
    for (const anchor of element.querySelectorAll<HTMLAnchorElement>("a[href]"))
      if (
        owner(anchor) === element &&
        anchor.protocol.startsWith("http") &&
        !links.includes(anchor.href) &&
        links.length < BLOCK_LINKS_MAX
      )
        links.push(anchor.href)
    const attrs: Record<string, string> = {}
    for (const { name, value } of element.attributes)
      if (value && value.length <= LABEL_ATTRIBUTE_MAX && !UNLABELLING_ATTRIBUTES.has(name) && !name.startsWith("data-bewpp"))
        attrs[name] = value
    return { text: squash(parts.join(" ")), attrs, links }
  })
}

/** A substring text match also matches every ancestor; Playwright's getByText keeps only the smallest. */
const innermost = (elements: HTMLElement[]) =>
  elements.filter(element => !elements.some(other => other !== element && element.contains(other)))

let markSequence = 0
/**
 * Tags a Playwright selector's matches `data-bewpp-hit="<marker>-<index>"` so a later action addresses
 * exactly them. A strict resolution throws the engine's own strict-mode violation text.
 */
function resolveMarked(selector: string, strict: boolean) {
  const engine = bundledEngine()
  if (!engine) return { count: 0, marker: "", installed: false }
  const parsed = engine.parseSelector(selector)
  const found = strict ? [engine.querySelector(parsed, document, true)] : engine.querySelectorAll(parsed, document)
  const elements = found.filter((element): element is Element => !!element)
  const marker = `b${++markSequence}`
  for (const [index, element] of elements.entries()) element.setAttribute("data-bewpp-hit", `${marker}-${index}`)
  return { count: elements.length, marker, installed: true }
}

export function resolveLocator(query: LocatorQuery, root: HTMLElement = document.body): HTMLElement[] {
  if (query.marker) return markedElements(query.marker)
  const bundled = bundledEngine()
  if (bundled && root === document.body)
    return bundled.querySelectorAll(bundled.parseSelector(playwrightSelector(query)), document) as HTMLElement[]
  const roots = query.within ? resolveLocator(query.within, root) : [root]
  let elements = roots.flatMap(container => {
    const exact = query.exact ?? false
    if (query.role) return queryAllByRole(container, query.role, { name: query.name, hidden: false })
    if (query.placeholder) return queryAllByPlaceholderText(container, query.placeholder, { exact })
    if (query.label) return queryAllByLabelText(container, query.label, { exact })
    if (query.testid) return queryAllByTestId(container, query.testid, { exact: true })
    if (query.text) return innermost(queryAllByText(container, query.text, { exact, ignore: "script, style" }))
    if (query.selector) return [...container.querySelectorAll<HTMLElement>(query.selector)]
    throw new Error("A locator must specify role, label, placeholder, test ID, text, or CSS.")
  })
  if (query.visible != null) elements = elements.filter(element => visible(element) === query.visible)
  if (query.has) elements = elements.filter(element => resolveLocator(query.has!, element).length > 0)
  if (query.hasText) {
    const needle = query.hasText.toLowerCase()
    elements = elements.filter(element => (element.textContent ?? "").toLowerCase().includes(needle))
  }
  if (query.last) elements = elements.slice(-1)
  if (query.indexes?.length) {
    for (const index of query.indexes) {
      const element = elements.at(index)
      elements = element ? [element] : []
    }
  }
  if (query.index != null) {
    const element = elements.at(query.index)
    elements = element ? [element] : []
  }
  return elements
}

/** Drops absent fields. `aria-checked="false"` survives because it arrives as a string. */
function prune<T extends Record<string, unknown>>(entry: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(entry).filter(([, value]) => value != null && value !== "" && value !== false),
  ) as Partial<T>
}

export function inspectDocument() {
  return {
    url: location.href,
    text: document.body.innerText.slice(0, INSPECT_TEXT_MAX),
    controls: [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input, textarea, select, [role="button"], [role="combobox"], [role="menuitem"], [role="option"], [contenteditable="true"]',
      ),
    ]
      .filter(visible)
      .map(element =>
        prune({
        tag: element.tagName,
        role: element.getAttribute("role"),
        type: element.getAttribute("type"),
        label: element.getAttribute("aria-label"),
        title: element.getAttribute("title"),
        placeholder: element.getAttribute("placeholder"),
        testid: element.getAttribute("data-testid"),
        href: element.getAttribute("href"),
        expanded: element.getAttribute("aria-expanded"),
        checked: element.getAttribute("aria-checked"),
        selected: element.getAttribute("aria-selected"),
        disabled: disabled(element),
        value: element.matches('input:not([type="password"]):not([type="file"]), textarea, select')
          ? (element as HTMLInputElement).value
          : undefined,
        text: element.matches("a, button, [role]") ? element.textContent?.trim().slice(0, 160) : undefined,
        }),
      ),
  }
}

export async function executeDom(command: DomCommand): Promise<unknown> {
  if (command.op === "inspect") return inspectDocument()
  if (command.op === "location") return location.href
  if (command.op === "resolve") return resolveMarked(command.selector, command.strict ?? false)
  if (command.op === "storage") {
    const store = command.kind === "localStorage" ? localStorage : sessionStorage
    return command.key === undefined ? Object.fromEntries(Object.entries({ ...store })) : store.getItem(command.key)
  }
  if (command.op === "observe") return executeObservation(command)
  if (command.op === "images")
    return [...document.images]
      .filter(image => visible(image) && image.complete && image.naturalWidth >= 256 && image.naturalHeight >= 256)
      .map(image => ({ src: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight }))
  if (command.op === "download") {
    if (![...document.images].some(image => (image.currentSrc || image.src) === command.url))
      throw new Error("Image is no longer present on the page.")
    const response = await fetch(command.url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`Image download failed (${response.status}).`)
    const blob = await response.blob()
    if (!blob.type.startsWith("image/") || blob.size > 32 * 1024 * 1024)
      throw new Error("Invalid or oversized image response.")
    return new Promise<ImageAsset>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ mime: blob.type, base64: String(reader.result).split(",")[1] })
      reader.onerror = () => reject(new Error("Could not read image bytes."))
      reader.readAsDataURL(blob)
    })
  }
  if (command.op !== "query") throw new Error("Unsupported DOM operation.")
  const read = () => resolveLocator(command.query)
  if (command.action === "count") return read().length
  if (command.action === "visible") return read().some(visible)
  if (command.action === "texts") return read().map(element => squash(element.textContent ?? ""))
  if (command.action === "blocks") return blocks(read())
  // Reads do not require Playwright actionability. This also keeps attached hidden
  // elements readable when a selector engine supplied the marker.
  if (command.action === "text" || command.action === "attribute") {
    const elements = read()
    if (elements.length !== 1) throw new Error(oneElementMessage(elements.length))
    return command.action === "text"
      ? elements[0].textContent
      : command.value
        ? elements[0].getAttribute(command.value)
        : null
  }
  if (command.action === "wait") {
    await waitFor(
      () => {
        const elements = read()
        const ready =
          command.state === "detached"
            ? elements.length === 0
            : command.state === "hidden"
              ? !elements.some(visible)
              : command.state === "attached"
                ? elements.length === 1
                : elements.length === 1 && visible(elements[0])
        if (!ready)
          throw new Error(
            `Waiting for locator to become ${command.state}: found ${elements.length}, visible ${elements.filter(visible).length}.`,
          )
      },
      {
        timeout: command.timeoutMs ?? LOCATOR_TIMEOUT_MS,
        interval: command.background ? 100 : undefined,
        onTimeout: error => error,
      },
    )
    return
  }
  const element = await waitFor(
    () => {
      const elements = read()
      if (elements.length !== 1) throw new Error(oneElementMessage(elements.length))
      if (!command.background && !visible(elements[0])) throw new Error("Element is hidden.")
      return elements[0]
    },
    {
      timeout: command.timeoutMs ?? LOCATOR_TIMEOUT_MS,
      interval: command.background ? 100 : undefined,
      onTimeout: error => error,
    },
  )
  if (command.action === "enabled") return !disabled(element)
  if (command.action === "value") return (element as HTMLInputElement).value
  if (command.action === "checked")
    return element.matches("input[type=checkbox], input[type=radio]")
      ? (element as HTMLInputElement).checked
      : element.getAttribute("aria-checked") === "true"
  if (disabled(element)) throw new Error("Element is disabled.")
  const user = userEvent.setup({
    document,
    delay: command.delayMs ?? null,
    // Explicit automation clicks can target controls under CSS pointer suppression.
    // Disabled controls and submission authorization remain checked separately.
    ...(command.action === "click" ? { pointerEventsCheck: PointerEventsCheckLevel.Never } : {}),
  })
  if (command.action === "click") {
    const button = element.closest("button, input, [role=button]") as HTMLButtonElement | null
    const submits =
      button &&
      ((button.type === "submit" && !!button.form) ||
        /^(generate|send|submit|purchase|buy|delete)(\s+(image|images|session|now))?$/i.test(
          (button.getAttribute("aria-label") || button.textContent || button.value || "").trim(),
        ))
    if (submits && !command.allowSubmit) throw new Error("Submission requires a explicit allowSubmit action.")
    const rect = element.getBoundingClientRect()
    const link = element.closest("a[href]") as HTMLAnchorElement | null
    const openInBackground = link?.target === "_blank" ? link.href : undefined
    const preventForegroundOpen = (event: MouseEvent) => {
      if (openInBackground && (event.target === element || element.contains(event.target as Node))) event.preventDefault()
    }
    if (openInBackground) document.addEventListener("click", preventForegroundOpen, true)
    try {
      await user.pointer({
        target: element,
        coords: { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 },
        keys: "[MouseLeft]",
      })
    } finally {
      if (openInBackground) document.removeEventListener("click", preventForegroundOpen, true)
    }
    if (openInBackground) return { openInBackground }
  } else if (command.action === "tap") {
    // Framer and similar tap handlers ignore synthesized clicks that omit composed pointer identity.
    if (!command.allowSubmit && element.closest("form")) throw new Error("Submission requires a explicit allowSubmit action.")
    const rect = element.getBoundingClientRect()
    const shared = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    }
    element.dispatchEvent(new PointerEvent("pointerover", { ...shared, buttons: 0 }))
    element.dispatchEvent(new PointerEvent("pointerenter", { ...shared, buttons: 0 }))
    element.dispatchEvent(new PointerEvent("pointerdown", { ...shared, buttons: 1 }))
    element.dispatchEvent(new MouseEvent("mousedown", { ...shared, buttons: 1 }))
    element.dispatchEvent(new PointerEvent("pointerup", { ...shared, buttons: 0 }))
    element.dispatchEvent(new MouseEvent("mouseup", { ...shared, buttons: 0 }))
    element.dispatchEvent(new MouseEvent("click", { ...shared, buttons: 0, detail: 1 }))
  } else if (command.action === "fill") {
    if (command.value == null || command.value.length > 16_000)
      throw new Error("A value of at most 16000 characters is required.")
    if (!element.matches('input:not([type="file"]):not([type="password"]), textarea'))
      throw new Error("Fill requires a text input or textarea.")
    element.focus()
    fireEvent.input(element, { target: { value: command.value }, inputType: "insertText", data: command.value })
    fireEvent.change(element, { target: { value: command.value } })
  } else if (command.action === "select") {
    const option = [...(element as HTMLSelectElement).options].find(option => option.label === command.value)
    if (!option) throw new Error("Select option not found.")
    await user.selectOptions(element, option)
  } else if (command.action === "press") {
    if (
      !/^(Escape|Tab|Enter|NumpadEnter|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown|Backspace|Delete)$/.test(command.value ?? "")
    )
      throw new Error("Unsupported navigation key.")
    element.focus()
    await user.keyboard(`{${command.value}}`)
  } else if (command.action === "hover") await user.hover(element)
}
