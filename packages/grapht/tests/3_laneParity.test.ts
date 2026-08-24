import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"
import { VISUAL_VALIDITY_VIEWPORT } from "../src/index.js"

const CAMERA_TOLERANCE = 1e-6
const COVERAGE_TOLERANCE = 0.02
const EXPECTED_TOTAL_PIXELS = VISUAL_VALIDITY_VIEWPORT.width * VISUAL_VALIDITY_VIEWPORT.height

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const lanes = {
  pixi: join(packageRoot, "adapters/6_render_pixijs/receipts/massive"),
  three: join(packageRoot, "adapters/7_render_threejs/receipts/massive"),
}

type LaneReceipt = {
  nodes: number
  representation: string
  nodeCount: number
  edgeCount: number
  fixtureSource?: { sha256: string }
  cameraState?: { tx: number; ty: number; zoom: number }
  visualValidity?: { totalPixels: number; nonBackgroundPixels: number; coverageRatio: number }
}

function readLane(directory: string): Map<string, LaneReceipt> {
  const receipts = new Map<string, LaneReceipt>()
  if (!existsSync(directory)) return receipts
  for (const name of readdirSync(directory)) {
    if (!name.endsWith(".json")) continue
    const receipt = JSON.parse(readFileSync(join(directory, name), "utf8")) as LaneReceipt
    if (typeof receipt.nodes !== "number" || typeof receipt.representation !== "string") continue
    receipts.set(`${receipt.representation}-${receipt.nodes}`, receipt)
  }
  return receipts
}

const pixi = readLane(lanes.pixi)
const three = readLane(lanes.three)
const shared = [...pixi.keys()].filter(key => three.has(key)).sort()

describe("massive receipt lane parity", () => {
  if (shared.length === 0) {
    test.skip(
      "skipped: no paired massive receipts. Generate them with GRAPHT_MASSIVE=1 pnpm --dir adapters/<lane> exec playwright test e2e/2_massive.spec.ts --workers=1",
      () => {},
    )
    return
  }

  for (const key of shared) {
    const a = pixi.get(key)!
    const b = three.get(key)!

    test(`${key} samples the same declared viewport`, () => {
      expect(a.visualValidity?.totalPixels).toBe(EXPECTED_TOTAL_PIXELS)
      expect(b.visualValidity?.totalPixels).toBe(EXPECTED_TOTAL_PIXELS)
    })

    test(`${key} fits the same camera`, () => {
      expect(a.cameraState).toBeDefined()
      expect(b.cameraState).toBeDefined()
      expect(Math.abs(a.cameraState!.tx - b.cameraState!.tx)).toBeLessThanOrEqual(CAMERA_TOLERANCE)
      expect(Math.abs(a.cameraState!.ty - b.cameraState!.ty)).toBeLessThanOrEqual(CAMERA_TOLERANCE)
      expect(Math.abs(a.cameraState!.zoom - b.cameraState!.zoom)).toBeLessThanOrEqual(CAMERA_TOLERANCE)
    })

    test(`${key} loads the same fixture`, () => {
      expect(a.nodeCount).toBe(b.nodeCount)
      expect(a.edgeCount).toBe(b.edgeCount)
      expect(a.fixtureSource?.sha256).toBeDefined()
      expect(a.fixtureSource?.sha256).toBe(b.fixtureSource?.sha256)
    })

    test(`${key} paints the same share of the viewport`, () => {
      const pixiRatio = a.visualValidity!.coverageRatio
      const threeRatio = b.visualValidity!.coverageRatio
      expect(pixiRatio).toBeCloseTo(a.visualValidity!.nonBackgroundPixels / a.visualValidity!.totalPixels, 12)
      expect(threeRatio).toBeCloseTo(b.visualValidity!.nonBackgroundPixels / b.visualValidity!.totalPixels, 12)
      expect(Math.abs(pixiRatio - threeRatio)).toBeLessThanOrEqual(COVERAGE_TOLERANCE)
    })
  }
})
