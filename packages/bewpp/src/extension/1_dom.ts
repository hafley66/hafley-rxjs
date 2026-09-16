import {
  fireEvent,
  queryAllByLabelText,
  queryAllByPlaceholderText,
  queryAllByRole,
  queryAllByTestId,
  waitFor,
} from "@testing-library/dom"
import userEvent from "@testing-library/user-event"
import type { DomCommand, ImageAsset, LocatorQuery } from "../0_controls.js"
import { executeObservation } from "./1_observe.js"

const visible = (element: Element) =>
  !!element.getClientRects().length &&
  getComputedStyle(element).visibility !== "hidden" &&
  !element.closest("[hidden], [inert]")
const disabled = (element: Element) => element.matches(":disabled") || element.getAttribute("aria-disabled") === "true"

export function resolveLocator(query: LocatorQuery, root: HTMLElement = document.body): HTMLElement[] {
  const roots = query.within ? resolveLocator(query.within, root) : [root]
  let elements = roots.flatMap(container => {
    if (query.role) return queryAllByRole(container, query.role, { name: query.name, hidden: false })
    if (query.placeholder) return queryAllByPlaceholderText(container, query.placeholder, { exact: true })
    if (query.label) return queryAllByLabelText(container, query.label, { exact: true })
    if (query.testid) return queryAllByTestId(container, query.testid, { exact: true })
    if (query.selector) return [...container.querySelectorAll<HTMLElement>(query.selector)]
    throw new Error("A locator must specify role, label, placeholder, test ID, or CSS.")
  })
  if (query.visible != null) elements = elements.filter(element => visible(element) === query.visible)
  if (query.has) elements = elements.filter(element => resolveLocator(query.has!, element).length > 0)
  if (query.last) elements = elements.slice(-1)
  if (query.index != null) {
    const element = elements.at(query.index)
    elements = element ? [element] : []
  }
  return elements
}

export function inspectDocument() {
  return {
    url: location.href,
    text: document.body.innerText.slice(0, 12_000),
    controls: [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input, textarea, select, [role="button"], [role="combobox"], [role="menuitem"], [role="option"], [contenteditable="true"]',
      ),
    ]
      .filter(visible)
      .map(element => ({
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
      })),
  }
}

export async function executeDom(command: DomCommand): Promise<unknown> {
  if (command.op === "inspect") return inspectDocument()
  if (command.op === "location") return location.href
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
  if (command.action === "texts") return read().map(element => element.textContent ?? "")
  if (command.action === "wait") {
    await waitFor(
      () => {
        const elements = read()
        const ready =
          command.state === "detached"
            ? elements.length === 0
            : command.state === "hidden"
              ? !elements.some(visible)
              : elements.length === 1 && visible(elements[0])
        if (!ready)
          throw new Error(
            `Waiting for locator to become ${command.state}: found ${elements.length}, visible ${elements.filter(visible).length}.`,
          )
      },
      { timeout: command.timeoutMs ?? 5000, onTimeout: error => error },
    )
    return
  }
  const element = await waitFor(
    () => {
      const elements = read()
      if (elements.length !== 1) throw new Error(`Expected one element; found ${elements.length}.`)
      if (!visible(elements[0])) throw new Error("Element is hidden.")
      return elements[0]
    },
    { timeout: command.timeoutMs ?? 5000, onTimeout: error => error },
  )
  if (command.action === "enabled") return !disabled(element)
  if (command.action === "value") return (element as HTMLInputElement).value
  if (command.action === "checked")
    return element.matches("input[type=checkbox], input[type=radio]")
      ? (element as HTMLInputElement).checked
      : element.getAttribute("aria-checked") === "true"
  if (command.action === "text") return element.textContent
  if (command.action === "attribute") return command.value ? element.getAttribute(command.value) : null
  if (disabled(element)) throw new Error("Element is disabled.")
  const user = userEvent.setup({ document, delay: null })
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
    await user.pointer({
      target: element,
      coords: { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 },
      keys: "[MouseLeft]",
    })
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
      !["Escape", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(command.value ?? "")
    )
      throw new Error("Unsupported navigation key.")
    element.focus()
    await user.keyboard(`{${command.value}}`)
  } else if (command.action === "hover") await user.hover(element)
}
