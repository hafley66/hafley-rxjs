import { renderer, type Renderer } from "@hafley66/scene"
import { SVGScene } from "@pixi-essentials/svg"
import { Application, Container, CullerPlugin, Graphics, Rectangle, Text, extensions } from "pixi.js"
import { Viewport } from "pixi-viewport"
import { from, Observable } from "rxjs"
import { replaceSvgTextNodes } from "./15_svgText.js"
import { installViewportWheel } from "./16_viewportWheel.js"

export type PixiSvgViewportRuntime = {
  app: Application
  viewport: Viewport
}

export function pixiSvgViewportRuntime(host: HTMLElement): Observable<PixiSvgViewportRuntime> {
  return new Observable(subscriber => {
    extensions.add(CullerPlugin)
    const app = new Application()
    let wheel: { unsubscribe(): void } | undefined
    const initialization = from(app.init({
      preference: "webgl",
      autoStart: false,
      resizeTo: host,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
      background: 0x10151f,
    })).subscribe({
      next: () => {
        host.append(app.canvas)
        const viewport = new Viewport({
          screenWidth: app.screen.width,
          screenHeight: app.screen.height,
          worldWidth: 1,
          worldHeight: 1,
          events: app.renderer.events,
          ticker: app.ticker,
          allowPreserveDragOutside: true,
        })
        viewport.drag().pinch().wheel({ trackpadPinch: true, wheelZoom: false }).decelerate()
          .clamp({ direction: "all", underflow: "center" })
          .clampZoom({ minScale: 0.2, maxScale: 6 })
        wheel = installViewportWheel(viewport)
        app.stage.addChild(viewport)
        subscriber.next({ app, viewport })
      },
      error: error => subscriber.error(error),
    })

    return () => {
      initialization.unsubscribe()
      wheel?.unsubscribe()
      if (app.renderer) app.destroy({ removeView: true })
    }
  })
}

export type SvgViewportFrame<Format extends string = string> = {
  format: Format
  root: SVGSVGElement
  width: number
  height: number
  viewBoxX: number
  viewBoxY: number
  codeBlocks: readonly SvgCodeBlock[]
}

export type SvgCodeBlock = {
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  lines: readonly { x: number; y: number; text: string }[]
}

function translate(element: Element): { x: number; y: number } {
  let x = 0
  let y = 0
  for (let current: Element | null = element; current; current = current.parentElement) {
    const match = current.getAttribute("transform")?.match(/translate\(([-.\d]+)[ ,]+([-.\d]+)\)/)
    if (match) {
      x += Number(match[1])
      y += Number(match[2])
    }
    if (current.tagName.toLowerCase() === "svg" && current !== element.ownerDocument.documentElement) {
      const viewBox = (current as unknown as SVGSVGElement).viewBox.baseVal
      x -= viewBox.x
      y -= viewBox.y
    }
  }
  return { x, y }
}

function extractCodeBlocks(root: SVGSVGElement): SvgCodeBlock[] {
  return [...root.querySelectorAll<SVGGElement>(".light-code")].flatMap(group => {
    const rect = group.querySelector("rect")
    if (!rect) return []
    const origin = translate(group)
    const fontSize = Number(group.getAttribute("style")?.match(/font-size:\s*([\d.]+)/)?.[1] ?? 16)
    return [{
      x: origin.x,
      y: origin.y,
      width: Number(rect.getAttribute("width")),
      height: Number(rect.getAttribute("height")),
      fontSize,
      lines: [...group.querySelectorAll<SVGTextElement>("text")].map(line => {
        const lineOrigin = translate(line)
        const y = line.getAttribute("y") ?? "0"
        return {
          x: lineOrigin.x + Number(line.getAttribute("x") ?? 0),
          y: lineOrigin.y + (y.endsWith("em") ? Number(y.slice(0, -2)) * fontSize : Number(y)),
          text: line.textContent ?? "",
        }
      }),
    }]
  })
}

export async function loadSvgViewportFrame<Format extends string>(format: Format, url: URL): Promise<SvgViewportFrame<Format>> {
  const svg = await fetch(url).then(response => response.text())
  const root = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement as unknown as SVGSVGElement
  const codeBlocks = extractCodeBlocks(root)
  for (const code of root.querySelectorAll(".light-code, .dark-code")) code.remove()
  for (const masked of root.querySelectorAll("[mask]")) masked.removeAttribute("mask")
  for (const mask of root.querySelectorAll("mask")) mask.remove()
  const viewBox = root.viewBox.baseVal
  return {
    format,
    root,
    width: viewBox.width || Number(root.getAttribute("width")),
    height: viewBox.height || Number(root.getAttribute("height")),
    viewBoxX: viewBox.x,
    viewBoxY: viewBox.y,
    codeBlocks,
  }
}

export function pixiSvgViewport<Format extends string>(config: {
  app: Application
  viewport: Viewport
  buttons: readonly HTMLButtonElement[]
  receipt: HTMLOutputElement
}): Renderer<SvgViewportFrame<Format>> {
  return renderer<{ scene?: SVGScene }, SvgViewportFrame<Format>>({
    subscribe: () => ({}),
    next: (state, frame) => {
      if (state.scene) config.viewport.removeChild(state.scene)
      const scene = new SVGScene(frame.root)
      const nodes = (scene as unknown as { _elementToRenderNode: Map<SVGElement, Container> })._elementToRenderNode
      const texts = replaceSvgTextNodes({ root: frame.root, nodes, resolution: config.app.renderer.resolution })
      const codeLayer = new Container()
      for (const block of frame.codeBlocks) {
        codeLayer.addChild(new Graphics()
          .rect(block.x, block.y, block.width, block.height)
          .fill(0xffffff)
          .stroke({ color: 0x0a0f25, width: 2 }))
        for (const line of block.lines) {
          codeLayer.addChild(new Text({
            text: line.text,
            x: line.x,
            y: line.y - block.fontSize,
            resolution: config.app.renderer.resolution,
            style: { fill: 0x0a0f25, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: block.fontSize },
          }))
        }
      }
      scene.addChild(codeLayer)
      scene.position.set(-frame.viewBoxX, -frame.viewBoxY)
      scene.cullable = true
      scene.cullArea = new Rectangle(frame.viewBoxX, frame.viewBoxY, frame.width, frame.height)
      config.viewport.addChild(scene)
      scene.drawPaints(config.app.renderer)
      config.viewport.resize(config.app.screen.width, config.app.screen.height, frame.width, frame.height)
      config.viewport.fitWorld(true)
      config.app.render()
      state.scene = scene

      for (const button of config.buttons) button.toggleAttribute("aria-pressed", button.dataset.format === frame.format)
      const host = config.app.canvas.parentElement!
      const codeLineCount = frame.codeBlocks.reduce((count, block) => count + block.lines.length, 0)
      host.dataset.format = frame.format
      host.dataset.textCount = String(texts.length + codeLineCount)
      host.dataset.invalidTextPositions = String(texts.filter(text => !Number.isFinite(text.x) || !Number.isFinite(text.y)).length)
      host.dataset.codeBlockCount = String(frame.codeBlocks.length)
      host.dataset.ready = "true"
      config.receipt.value = JSON.stringify({ format: frame.format, width: frame.width, height: frame.height, textCount: texts.length + codeLineCount, gesture: "pinch=zoom, scroll=vertical, command-scroll=horizontal" }, null, 2)
    },
    unsubscribe: state => {
      if (state.scene) config.viewport.removeChild(state.scene)
    },
  })
}
