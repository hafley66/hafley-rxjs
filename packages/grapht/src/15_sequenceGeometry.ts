import { chromium } from "playwright"

import { documentFingerprint } from "./12_sequenceIdentity.js"
import {
  decorateSvg,
  type NativeRenderReceipt,
  type SvgBindingReceipt,
  type SvgBindingRole,
} from "./13_sequenceSvgBinding.js"
import type { SequenceArtifact } from "./14_sequenceArtifact.js"

export type Rect = { x: number; y: number; width: number; height: number }
export type Matrix2D = { a: number; b: number; c: number; d: number; e: number; f: number }
export type EntityGeometry = {
  occurrenceId: string
  role: SvgBindingRole
  localBounds: Rect
  worldBounds: Rect
  transform: Matrix2D
  elementId: string
}
export type GeometryDiagnostic = {
  code: "SEQUENCE_MISSING_SVG_BINDING" | "SEQUENCE_MULTIPLE_SVG_BINDINGS"
  occurrenceId: string
  elementId: string
  count: number
}
export type SequenceGeometry = {
  id: string
  renderRevisionId: string
  coordinateSpace: "svg-viewBox"
  viewBox: Rect
  entities: EntityGeometry[]
  diagnostics: GeometryDiagnostic[]
  browser: { version: string; devicePixelRatio: number; theme: string; fontsReady: boolean }
}

export async function measureSequenceSvg(
  artifact: SequenceArtifact,
  bindingReceipt: SvgBindingReceipt,
  receipt: NativeRenderReceipt,
  options: { cssWidth?: number; theme?: string } = {},
): Promise<SequenceGeometry> {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 })
    const decorated = decorateSvg(receipt, bindingReceipt)
    await page.setContent(`<style>svg{width:${options.cssWidth ?? 700}px;height:auto}</style>${decorated}`)
    const measured = await page.evaluate(
      async ({ bindings, theme }) => {
        await document.fonts.ready
        const svg = document.querySelector("svg")
        if (!svg) throw new Error("decorated SVG did not mount")
        const box = svg.viewBox.baseVal
        const rootMatrix = svg.getCTM()
        if (!rootMatrix) throw new Error("mounted SVG has no CTM")
        const determinant = rootMatrix.a * rootMatrix.d - rootMatrix.b * rootMatrix.c
        if (determinant === 0) throw new Error("mounted SVG CTM is singular")
        const inverseRoot = {
          a: rootMatrix.d / determinant,
          b: -rootMatrix.b / determinant,
          c: -rootMatrix.c / determinant,
          d: rootMatrix.a / determinant,
          e: (rootMatrix.c * rootMatrix.f - rootMatrix.d * rootMatrix.e) / determinant,
          f: (rootMatrix.b * rootMatrix.e - rootMatrix.a * rootMatrix.f) / determinant,
        }
        const entities: EntityGeometry[] = []
        const diagnostics: GeometryDiagnostic[] = []
        for (const binding of bindings) {
          const elements = [...svg.querySelectorAll(`[id="${binding.elementId}"]`)] as SVGGraphicsElement[]
          if (elements.length !== 1) {
            diagnostics.push({
              code: elements.length === 0 ? "SEQUENCE_MISSING_SVG_BINDING" : "SEQUENCE_MULTIPLE_SVG_BINDINGS",
              occurrenceId: binding.occurrenceId,
              elementId: binding.elementId,
              count: elements.length,
            })
            continue
          }
          const element = elements[0]
          const local = element.getBBox()
          const matrix = element.getCTM()
          if (!matrix) throw new Error(`SVG binding has no CTM: ${binding.elementId}`)
          const points = [
            [local.x, local.y],
            [local.x + local.width, local.y],
            [local.x, local.y + local.height],
            [local.x + local.width, local.y + local.height],
          ].map(([x, y]) => {
            const rendered = { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f }
            return {
              x: inverseRoot.a * rendered.x + inverseRoot.c * rendered.y + inverseRoot.e,
              y: inverseRoot.b * rendered.x + inverseRoot.d * rendered.y + inverseRoot.f,
            }
          })
          const xs = points.map(point => point.x)
          const ys = points.map(point => point.y)
          entities.push({
            occurrenceId: binding.occurrenceId,
            role: binding.role,
            elementId: binding.elementId,
            localBounds: { x: local.x, y: local.y, width: local.width, height: local.height },
            worldBounds: {
              x: Math.min(...xs),
              y: Math.min(...ys),
              width: Math.max(...xs) - Math.min(...xs),
              height: Math.max(...ys) - Math.min(...ys),
            },
            transform: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f },
          })
        }
        return {
          viewBox: { x: box.x, y: box.y, width: box.width, height: box.height },
          entities,
          diagnostics,
          devicePixelRatio: devicePixelRatio,
          theme,
          fontsReady: document.fonts.status === "loaded",
        }
      },
      { bindings: bindingReceipt.bindings, theme: options.theme ?? "base" },
    )
    return {
      id: `geometry:${documentFingerprint([artifact.renderRevision.id, measured])}`,
      renderRevisionId: artifact.renderRevision.id,
      coordinateSpace: "svg-viewBox",
      viewBox: measured.viewBox,
      entities: measured.entities,
      diagnostics: measured.diagnostics,
      browser: {
        version: browser.version(),
        devicePixelRatio: measured.devicePixelRatio,
        theme: measured.theme,
        fontsReady: measured.fontsReady,
      },
    }
  } finally {
    await browser.close()
  }
}
