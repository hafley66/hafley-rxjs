import { describe, expect, it } from "vitest"
import type * as z from "zod"
import type { AnySpec } from "./0_spec.js"
import { mergeSearch, parseSearch, printSearch, queryRoute } from "./1_url.js"

const eye = {
  seed: { kind: "seed", default: 3 },
  shape: { kind: "select", options: ["human", "shoujo"], default: "human" },
  lash: { kind: "select", options: ["slots", "slots×k"], default: "slots" },
  dress: { kind: "bool", default: true },
} as const satisfies AnySpec
const slice = {
  curve: { kind: "select", options: ["linear", "levy"], default: "linear" },
  gain: { kind: "range", min: 0, max: 4, step: 0.1, default: 1.5 },
} as const satisfies AnySpec
const ns = { eye, slice }

describe("url", () => {
  it("builds one route whose query keys are namespaced", () => {
    const r = queryRoute(ns)
    expect(Object.keys((r.schema as unknown as z.ZodObject).shape)).toEqual([
      "eye.seed",
      "eye.shape",
      "eye.lash",
      "eye.dress",
      "slice.curve",
      "slice.gain",
    ])
  })
  it("reads namespaced values, filling defaults and dropping junk", () => {
    expect(parseSearch("?eye.seed=7&eye.shape=shoujo&slice.curve=levy&eye.dress=false&eye.junk=1&other=2", ns)).toEqual(
      {
        eye: { seed: 7, shape: "shoujo", lash: "slots", dress: false },
        slice: { curve: "levy", gain: 1.5 },
      },
    )
    expect(parseSearch("?eye.shape=dog&slice.gain=abc", ns)).toEqual({
      eye: { seed: 3, shape: "human", lash: "slots", dress: true },
      slice: { curve: "linear", gain: 1.5 },
    })
    expect(parseSearch("", ns).eye.seed).toBe(3)
  })
  it("prints only non-default values and round-trips unicode", () => {
    const s = printSearch(
      { eye: { seed: 3, shape: "shoujo", lash: "slots×k", dress: false }, slice: { curve: "linear", gain: 2 } },
      ns,
    )
    expect(s).toBe("?eye.shape=shoujo&eye.lash=slots%C3%97k&eye.dress=false&slice.gain=2")
    expect(parseSearch(s, ns)).toEqual({
      eye: { seed: 3, shape: "shoujo", lash: "slots×k", dress: false },
      slice: { curve: "linear", gain: 2 },
    })
    expect(
      printSearch(
        { eye: { seed: 3, shape: "human", lash: "slots", dress: true }, slice: { curve: "linear", gain: 1.5 } },
        ns,
      ),
    ).toBe("")
  })
  it("merge keeps foreign keys and replaces owned namespaces", () => {
    expect(mergeSearch("?eye.seed=1&x=9&slice.gain=2", "?eye.seed=5", ns)).toBe("?x=9&eye.seed=5")
    expect(mergeSearch("?eye.seed=1", "", ns)).toBe("")
  })
})
