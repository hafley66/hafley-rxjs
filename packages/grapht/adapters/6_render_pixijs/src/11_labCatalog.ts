export {}

type Demo = {
  id: string
  group: string
  title: string
  description: string
  path: string
}

const demos: Demo[] = [
  { id: "benchmark", group: "Graph rendering", title: "Renderer benchmark", description: "WebGL and WebGPU renderer fixture harness.", path: "../index.html?nodes=1000&renderer=webgl&representation=retained&pause=1" },
  { id: "graph-canvas", group: "Graph rendering", title: "Interactive graph canvas", description: "Node picking, dragging, camera pan, zoom, and graph hover states.", path: "./graph-canvas.html" },
  { id: "ecosystem", group: "Graph rendering", title: "Pixi ecosystem sequence", description: "SVGScene, viewport, layout, UI, culling, and DOM overlay compatibility.", path: "./ecosystem.html" },
  { id: "scene-grid", group: "Scene pipeline", title: "Scene grid", description: "Scene model projected through the Pixi adapter.", path: "./scene-grid.html" },
  { id: "scene-cube", group: "Scene pipeline", title: "Scene cube", description: "Scene primitives rendered through Pixi.", path: "./scene-cube.html" },
  { id: "dom-cube", group: "Scene pipeline", title: "DOM cube", description: "DOM rendering reference for scene output.", path: "./dom-cube.html" },
]

function required<ElementType extends Element>(selector: string) {
  const element = document.querySelector<ElementType>(selector)
  if (!element) throw new Error(`demo catalog mount missing: ${selector}`)
  return element
}

const demoNavigation = required<HTMLElement>("#demo-navigation")
const frame = required<HTMLIFrameElement>("#demo-frame")
const title = required<HTMLElement>("#demo-title")
const groupLabel = required<HTMLElement>("#demo-group")
const description = required<HTMLElement>("#demo-description")
const standalone = required<HTMLAnchorElement>("#demo-standalone")
const filter = required<HTMLInputElement>("#demo-filter")

const buttons = new Map<string, HTMLButtonElement>()
for (const group of [...new Set(demos.map(demo => demo.group))]) {
  const section = document.createElement("section")
  section.className = "demo-group"
  section.dataset.group = group
  const heading = document.createElement("h3")
  heading.textContent = group
  section.append(heading)
  for (const demo of demos.filter(item => item.group === group)) {
    const button = document.createElement("button")
    button.className = "demo-entry"
    button.type = "button"
    button.dataset.demo = demo.id
    button.textContent = demo.title
    button.addEventListener("click", () => selectDemo(demo, true))
    buttons.set(demo.id, button)
    section.append(button)
  }
  demoNavigation.append(section)
}

function selectDemo(demo: Demo, updateHistory: boolean) {
  for (const [id, button] of buttons) {
    if (id === demo.id) button.setAttribute("aria-current", "page")
    else button.removeAttribute("aria-current")
  }
  title.textContent = demo.title
  groupLabel.textContent = demo.group
  description.textContent = demo.description
  standalone.href = demo.path
  frame.src = demo.path
  frame.title = demo.title
  document.title = `${demo.title} | Pixi adapter demos`
  if (updateHistory) history.replaceState(null, "", `?demo=${encodeURIComponent(demo.id)}`)
}

filter.addEventListener("input", () => {
  const query = filter.value.trim().toLocaleLowerCase()
  for (const demo of demos) {
    buttons.get(demo.id)?.toggleAttribute("hidden", Boolean(query) && !`${demo.group} ${demo.title} ${demo.description}`.toLocaleLowerCase().includes(query))
  }
  for (const section of demoNavigation.querySelectorAll<HTMLElement>(".demo-group")) {
    section.toggleAttribute("hidden", !section.querySelector(".demo-entry:not([hidden])"))
  }
})

const requestedId = new URLSearchParams(location.search).get("demo")
selectDemo(demos.find(demo => demo.id === requestedId) ?? demos.find(demo => demo.id === "ecosystem")!, false)
