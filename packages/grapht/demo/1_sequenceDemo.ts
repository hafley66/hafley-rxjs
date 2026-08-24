import { createSequenceBoard, type SequenceBoardInput } from "../src/17_sequenceBoard.js"

type SequenceDemoResponse = { input: SequenceBoardInput; source: string }
type Controls = {
  language: HTMLSelectElement
  occurrence: HTMLSelectElement
  x: HTMLInputElement
  y: HTMLInputElement
  scale: HTMLInputElement
  reload: HTMLButtonElement
  status: HTMLElement
  receipt: HTMLElement
  source: HTMLElement
  host: HTMLElement
}

function element<T extends HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector)
  if (!value) throw new Error(`missing demo element ${selector}`)
  return value
}

const controls: Controls = {
  language: element("[data-language]"),
  occurrence: element("[data-occurrence]"),
  x: element("[data-camera-x]"),
  y: element("[data-camera-y]"),
  scale: element("[data-camera-scale]"),
  reload: element("[data-reload]"),
  status: element("[data-status]"),
  receipt: element("[data-receipt]"),
  source: element("[data-source]"),
  host: element("[data-board]"),
}
const board = createSequenceBoard(controls.host, { width: 900, height: 620 })

function renderReceipt() {
  controls.receipt.textContent = JSON.stringify(board.receipt(), null, 2)
}

function updateCamera() {
  board.setCamera({
    x: Number(controls.x.value),
    y: Number(controls.y.value),
    scale: Number(controls.scale.value),
  })
  renderReceipt()
}

async function load() {
  const language = controls.language.value
  controls.status.dataset.state = "loading"
  controls.status.textContent = `building ${language}`
  controls.reload.disabled = true

  try {
    const response = await fetch(`/api/sequence/${language}`)
    const result = await response.json() as SequenceDemoResponse | { error: string }
    if (!response.ok || "error" in result) throw new Error("error" in result ? result.error : response.statusText)

    board.replace(result.input)
    controls.source.textContent = result.source
    controls.occurrence.replaceChildren(
      ...result.input.artifact.occurrences.map(occurrence => {
        const option = document.createElement("option")
        option.value = occurrence.id
        option.textContent = `${occurrence.kind}: ${occurrence.label ?? occurrence.authoredId ?? occurrence.id}`
        return option
      }),
    )
    updateCamera()
    controls.status.dataset.state = "ready"
    controls.status.textContent = `${language} ready · ${result.input.artifact.occurrences.length} occurrences`
  } catch (error) {
    controls.status.dataset.state = "error"
    controls.status.textContent = error instanceof Error ? error.message : String(error)
  } finally {
    controls.reload.disabled = false
  }
}

controls.language.addEventListener("change", load)
controls.reload.addEventListener("click", load)
controls.occurrence.addEventListener("change", () => {
  board.focus(controls.occurrence.value)
  renderReceipt()
})
for (const input of [controls.x, controls.y, controls.scale]) input.addEventListener("input", updateCamera)

window.addEventListener("beforeunload", () => board.unmount())
void load()
