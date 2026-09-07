import { Signal } from "@hafley66/signals"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { page } from "vitest/browser"
import { type FsRow, FsTree, fsColumns } from "./FsTree"
import "../kit.css"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const NOW = 1_800_000_000_000
const MIN = 60_000
const tree = (): FsRow[] => [
  {
    id: "src",
    path: "src",
    name: "src",
    kind: "dir",
    loaded: true,
    children: [
      { id: "src/b.ts", path: "src/b.ts", name: "b.ts", kind: "file", size: 3000, mtime: NOW - 5 * MIN },
      { id: "src/a.ts", path: "src/a.ts", name: "a.ts", kind: "file", size: 120, mtime: NOW - 90 * MIN },
      { id: "src/lib", path: "src/lib", name: "lib", kind: "dir", loaded: false },
    ],
  },
  { id: "README.md", path: "README.md", name: "README.md", kind: "file", size: 1536, mtime: NOW - 2 * MIN },
  { id: "docs", path: "docs", name: "docs", kind: "dir", loaded: false },
]

let root: Root | null = null
afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.body.replaceChildren()
})

const names = () =>
  [...document.querySelectorAll("[data-testid=tree-row] .fs-name")].map(e => e.textContent?.replace(/^[▸·]/, ""))

function mount(rows: Signal<FsRow[]>, getChildren?: (r: FsRow) => Promise<FsRow[]>, onOpen?: (r: FsRow) => void) {
  const host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  act(() =>
    root?.render(<FsTree rows={rows} columns={fsColumns({ now: NOW })} getChildren={getChildren} onOpen={onOpen} />),
  )
}

describe("FsTree", () => {
  it("renders roots with dir glyphs, sizes on files only, ages from mtime", () => {
    mount(Signal<FsRow[]>(tree()))
    expect(names()).toEqual(["src", "README.md", "docs"])
    const cells = [...document.querySelectorAll("[data-testid=tree-row]")].map(tr =>
      [...tr.querySelectorAll("td")].map(td => td.textContent?.trim()),
    )
    expect(cells[1]?.slice(1)).toEqual(["1.5 KB", "2m ago"])
    expect(cells[0]?.slice(1)).toEqual(["", ""])
    expect(document.querySelector("[data-testid=toggle-docs]")).not.toBeNull()
    expect(document.querySelector('[data-testid="toggle-README.md"]')).toBeNull()
  })

  it("expanding an unloaded dir calls getChildren once and patches the rows signal", async () => {
    const rows = Signal<FsRow[]>(tree())
    const getChildren = vi.fn(async (r: FsRow) => [
      { id: `${r.id}/x.md`, path: `${r.id}/x.md`, name: "x.md", kind: "file" as const, size: 10 },
    ])
    mount(rows, getChildren)
    await act(async () => {
      await page.getByTestId("toggle-docs").click()
    })
    await vi.waitFor(() => expect(names()).toContain("x.md"))
    expect(getChildren).toHaveBeenCalledTimes(1)
    expect(rows.$()[2]?.loaded).toBe(true)
    await act(async () => {
      await page.getByTestId("toggle-docs").click()
    })
    await act(async () => {
      await page.getByTestId("toggle-docs").click()
    })
    expect(getChildren).toHaveBeenCalledTimes(1)
  })

  it("sorting by size never interleaves dirs with files; a file click opens it", async () => {
    const rows = Signal<FsRow[]>(tree())
    const onOpen = vi.fn()
    mount(rows, undefined, onOpen)
    await act(async () => {
      await page.getByTestId("toggle-src").click()
    })
    expect(names()).toEqual(["src", "b.ts", "a.ts", "lib", "README.md", "docs"])
    const clickSize = async () => {
      const th = document.querySelector<HTMLElement>('th[data-column="size"]')
      if (!th) throw new Error("no size header")
      await act(async () => th.click())
    }
    // whichever direction TanStack picks per click, dirs and files never interleave and files stay monotonic by bytes
    const kindOf = (n: string) => (n === "src" || n === "docs" || n === "lib" ? "d" : "f")
    const sizeOf = (n: string) => ({ "b.ts": 3000, "a.ts": 120, "README.md": 1536 })[n] ?? 0
    const check = (group: string[]) => {
      const kinds = group.map(kindOf).join("")
      expect(kinds === kinds.split("").sort().join("") || kinds === kinds.split("").sort().reverse().join("")).toBe(
        true,
      )
      const sizes = group.filter(n => kindOf(n) === "f").map(sizeOf)
      const asc = [...sizes].sort((a, b) => a - b)
      expect(sizes.join() === asc.join() || sizes.join() === asc.reverse().join()).toBe(true)
    }
    const groups = () => {
      const all = names().map(String)
      return {
        roots: all.filter(n => ["src", "README.md", "docs"].includes(n)),
        src: all.filter(n => ["b.ts", "a.ts", "lib"].includes(n)),
      }
    }
    const before = names().join()
    await clickSize()
    await vi.waitFor(() => expect(names().join()).not.toBe(before))
    let g = groups()
    check(g.roots)
    check(g.src)
    expect(g.roots.indexOf("README.md")).toBe(0)
    const mid = names().join()
    await clickSize()
    await vi.waitFor(() => expect(names().join()).not.toBe(mid))
    g = groups()
    check(g.roots)
    check(g.src)
    await act(async () => {
      await page.getByText("a.ts").click()
    })
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "src/a.ts" }))
  })
})
