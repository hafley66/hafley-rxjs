import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { scaffoldFixture } from "./0_fixture.js"

let fixture: ReturnType<typeof scaffoldFixture>
beforeEach(() => { fixture = scaffoldFixture() })
afterEach(() => fixture.unsubscribe())

describe("Bash scaffold", () => {
  it("creates typed kit pages, all field kinds, copies and compositions without editing source generators", () => {
    const before = fixture.sources()
    const commands = [
      ["page", "scaffold_receipt"],
      ["section", "scaffold_receipt", "scaffold_detail"],
      ...["range", "number", "seed", "select", "bool", "text"].map(kind => ["input", "scaffold_receipt", `field_${kind}`, kind]),
      ["copy", "scaffold_receipt", "scaffold_copy"],
      ["use", "scaffold_receipt", "comparison", "2_fma:fma2"],
      ["use", "scaffold_receipt", "packing", "1_fractal:apollonian"],
      ["section", "fma", "scaffold_orbit"],
    ]
    for (const command of commands) expect(fixture.run(...command)).toMatchObject({ status: 0, stderr: "" })
    expect(fixture.run("use", "scaffold_receipt", "variant", `${fixture.algo("scaffold_copy")}:ALGO`)).toMatchObject({ status: 0, stderr: "" })
    const after = fixture.sources()
    for (const [file, content] of Object.entries(before)) {
      if (file !== "src/app/0_pages.ts" && !content.includes("// scaffold:bindings")) expect(after[file], file).toBe(content)
    }
    expect(fixture.read(`src/algos/${fixture.algo("scaffold_receipt")}.ts`)).toMatchSnapshot()
    expect(fixture.read(`src/algos/${fixture.algo("scaffold_copy")}.ts`)).toBe(
      fixture.read(`src/algos/${fixture.algo("scaffold_receipt")}.ts`).replace('name: "scaffold_receipt"', 'name: "scaffold_copy"'),
    )
    expect(Object.fromEntries(Object.entries(after).filter(([file]) => file.endsWith("_scaffold_receipt.tsx"))
      .map(([file, content]) => [file.replace(/\d+_/g, "N_"), content.replace(/\d+_scaffold/g, "N_scaffold")]))).toMatchSnapshot()
    const types = fixture.command("pnpm", ["typecheck"])
    expect(types.status, types.stdout + types.stderr).toBe(0)
  }, 60_000)

  it("previews without writes and rejects invalid or duplicate requests before writing", () => {
    const initial = fixture.sources()
    const preview = fixture.run("page", "scaffold_receipt", "--dry-run")
    expect(preview.status, preview.stderr).toBe(0)
    expect(preview.stdout).toContain('id: "scaffold_receipt"')
    expect(fixture.sources()).toEqual(initial)
    expect(fixture.run("page", "scaffold_receipt").status).toBe(0)
    const before = fixture.sources()
    const commands = [
      ["page", "scaffold_receipt"], ["page", "../escape"], ["page", "bad;command"], ["page", "page"],
      ["section", "missing", "scaffold_orphan"],
      ["use", "scaffold_receipt", "scaffold_receipt", "2_fma:fma2"],
      ["use", "scaffold_receipt", "bad", "2_fma:absent"],
      ["use", "scaffold_receipt", "bad", "1_fractal:hilbertIndex"],
      ["input", "scaffold_receipt", "radius", "range"],
      ["input", "scaffold_receipt", "pin", "text"],
      ["input", "scaffold_receipt", "new_field", "unknown"],
      ["copy", "scaffold_receipt", "scaffold_receipt"],
    ]
    for (const command of commands) {
      const result = fixture.run(...command)
      expect(result.status, command.join(" ")).toBe(1)
      expect(fixture.sources(), command.join(" ")).toEqual(before)
    }
    expect(fixture.run("input", "--print", "petals", "range")).toMatchInlineSnapshot(`
      {
        "status": 0,
        "stderr": "",
        "stdout": "petals: { kind: \"range\", hint: \"petals\", min: 0, max: 100, step: 1, default: 50 },",
      }
    `)
    expect(fixture.sources()).toEqual(before)
  })

  it("rejects a missing insertion marker without leaving a new Algo behind", () => {
    expect(fixture.run("page", "scaffold_receipt").status).toBe(0)
    const page = Object.keys(fixture.sources()).find(f => f.endsWith("_scaffold_receipt.tsx"))!
    writeFileSync(join(fixture.cwd, page), fixture.read(page).replace("      {/* scaffold:sections */}", ""))
    const before = fixture.sources()
    const result = fixture.run("section", "scaffold_receipt", "scaffold_orphan")
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("needs exactly one")
    expect(fixture.sources()).toEqual(before)
  })
})
