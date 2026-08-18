import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { createRoot } from "react-dom/client"
import type { ColumnDef } from "@tanstack/react-table"
import { Signal } from "@hafley66/signals"
import { z } from "zod"
import { createDefaultGridState, createGrid } from "./2_createGrid"
import type { GridFeatures } from "./0_features"
import { GridTable, type RowDensity } from "./4_grid"

type PlaygroundRow = { id: string; label: string; group: string; amount: number }
type OwnerMode = "document" | "ancestor"
type PlaygroundGrid = ReturnType<typeof createGrid<PlaygroundRow>>

const rowSchema = z.object({ id: z.string(), label: z.string(), group: z.string(), amount: z.number() })
const rowCounts = [20, 160, 500, 5000, 50_000, 1_000_000] as const
const wideColumnCount = 6

function rowsFor(count: number): PlaygroundRow[] {
  const rows = new Array<PlaygroundRow>(count)
  for (let index = 0; index < count; index++) {
    rows[index] = {
      id: `row-${index}`,
      label: `Row ${String(index).padStart(7, "0")}`,
      group: `Group ${index % 8}`,
      amount: index * 17,
    }
  }
  return rows
}

function numericDataset(root: HTMLElement | null, key: string) {
  return Number(root?.dataset[key] ?? "0")
}

function scrollableOwnerNames(root: HTMLElement | null) {
  const candidates = [document.documentElement, document.body, ...(root ? [root, ...root.querySelectorAll<HTMLElement>("*")] : [])]
  return candidates
    .filter((element) => {
      const overflowY = getComputedStyle(element).overflowY
      return (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight
    })
    .map((element) => element === document.documentElement ? "document" : element === document.body ? "body" : element.dataset.testid ?? element.id ?? element.tagName.toLowerCase())
}

function App() {
  const [rowCount, setRowCount] = useState<(typeof rowCounts)[number]>(1_000_000)
  const [variableHeight, setVariableHeight] = useState(false)
  const [wideColumns, setWideColumns] = useState(false)
  const [ownerMode, setOwnerMode] = useState<OwnerMode>("document")
  const [density, setDensity] = useState<RowDensity>("standard")
  const [precedingHeight, setPrecedingHeight] = useState(720)
  const [revision, setRevision] = useState(0)
  const nestedRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  const allRows = useMemo(() => rowsFor(rowCount), [rowCount])
  const columns = useMemo<ColumnDef<GridFeatures, PlaygroundRow>[]>(() => {
    const base: ColumnDef<GridFeatures, PlaygroundRow>[] = [
      {
        accessorKey: "label",
        header: variableHeight ? "Variable-height row" : "Label",
        cell: ({ getValue, row }) => variableHeight
          ? <div style={{ height: row.index % 2 ? 72 : 48, display: "flex", alignItems: "center" }}>{getValue() as string}</div>
          : getValue() as string,
      },
      { accessorKey: "group", header: "Group" },
      { accessorKey: "amount", header: "Amount", meta: { align: "right" } },
    ]
    if (wideColumns) {
      for (let i = 0; i < wideColumnCount; i++) {
        base.push({
          id: `wide${i}`,
          accessorFn: (row) => row.label,
          header: `Wide ${i}`,
          size: 260,
        })
      }
    }
    return base
  }, [variableHeight, wideColumns])
  const grid = useMemo(() => createGrid<PlaygroundRow>({
    schema: rowSchema,
    rows: Signal<PlaygroundRow[]>(allRows),
    state: Signal(createDefaultGridState()),
    getRowId: (row) => row.id,
    columnDefs: columns,
    mode: "server",
  }), [columns, allRows])

  useEffect(() => {
    const owner = ownerMode === "ancestor" ? nestedRef.current : window
    const update = () => setRevision((value) => value + 1)
    owner?.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    const observer = new ResizeObserver(update)
    if (pageRef.current) observer.observe(pageRef.current)
    if (nestedRef.current) observer.observe(nestedRef.current)
    requestAnimationFrame(update)
    return () => {
      owner?.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      observer.disconnect()
    }
  }, [ownerMode, grid])

  const gridRoot = pageRef.current?.querySelector<HTMLElement>("[data-testid=grid]") ?? null
  const owner = ownerMode === "ancestor" ? nestedRef.current : null
  const scrollOffset = owner?.scrollTop ?? window.scrollY
  const mountedRows = pageRef.current?.querySelectorAll("[data-testid=grid-row]").length ?? 0
  const scrollableOwners = scrollableOwnerNames(pageRef.current)
  const ancestorLayout = ownerMode === "ancestor"

  return <main ref={pageRef} style={{ ...(ancestorLayout ? { height: "100dvh", display: "flex", flexDirection: "column" as const, overflow: "hidden" } : { minHeight: "100vh" }), background: "#f8fafc", color: "#111827", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
    <style>{`html, body, #root { margin: 0; min-height: 100% } * { box-sizing: border-box } select, input, button { font: inherit } ${ancestorLayout ? "html, body, #root { height: 100%; overflow: hidden }" : ""}`}</style>
    <section style={{ position: "sticky", top: 0, zIndex: 20, padding: 16, borderBottom: "1px solid #cbd5e1", background: "#ffffffee", backdropFilter: "blur(8px)" }}>
      <strong style={{ display: "block", marginBottom: 10, fontSize: 18 }}>@hafley66/grid external-scroll playground</strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
        <label>Rows<br /><select value={rowCount} onChange={(event) => setRowCount(Number(event.target.value) as typeof rowCount)}>{rowCounts.map((count) => <option key={count}>{count}</option>)}</select></label>
        <label>Height<br /><select value={String(variableHeight)} onChange={(event) => setVariableHeight(event.target.value === "true")}><option value="false">fixed</option><option value="true">variable</option></select></label>
        <label>Owner<br /><select value={ownerMode} onChange={(event) => setOwnerMode(event.target.value as OwnerMode)}><option value="document">document</option><option value="ancestor">nested overflow</option></select></label>
        <label>Columns<br /><select value={String(wideColumns)} onChange={(event) => setWideColumns(event.target.value === "true")}><option value="false">standard</option><option value="true">wide (h-scrollbar)</option></select></label>
        <label>Estimate density<br /><select value={density} onChange={(event) => setDensity(event.target.value as RowDensity)}><option value="compact">compact 30px</option><option value="standard">standard 42px</option><option value="cozy">cozy 52px</option></select></label>
        <label>Preceding px<br /><input type="number" min="0" step="40" value={precedingHeight} onChange={(event) => setPrecedingHeight(Math.max(0, Number(event.target.value) || 0))} style={{ width: 88 }} /></label>
        <button onClick={() => (owner ?? window).scrollTo({ top: 0, behavior: "smooth" })}>scroll to start</button>
      </div>
    </section>
    <section style={{ margin: 16, padding: 14, border: "2px solid #0f172a", borderRadius: 8, background: "#ffffff", fontSize: 14, lineHeight: 1.45 }}>
      <strong>Live diagnostics</strong>
      <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{[
        `total rows: ${rowCount}`,
        `mounted DOM rows: ${mountedRows}`,
        `visible range: ${numericDataset(gridRoot, "visibleStart")}..${numericDataset(gridRoot, "visibleEnd")}`,
        `scroll owner: ${gridRoot?.dataset.scrollOwner ?? ownerMode}`,
        `scroll offset: ${Math.round(scrollOffset)}`,
        `estimate px: ${gridRoot?.dataset.virtualEstimateSize ?? 0}`,
        `measured total px: ${gridRoot?.dataset.virtualTotalSize ?? 0}`,
        `grid document top: ${gridRoot ? Math.round(gridRoot.getBoundingClientRect().top + window.scrollY) : 0}`,
        `viewport height: ${owner?.clientHeight ?? window.innerHeight}`,
        `scrollable owners (${scrollableOwners.length}): ${scrollableOwners.join(", ") || "none"}`,
        `render revision: ${revision}`,
      ].join("\n")}</pre>
    </section>
    {ownerMode === "document" ? <DocumentScenario precedingHeight={precedingHeight} grid={grid} density={density} /> : <AncestorScenario precedingHeight={precedingHeight} nestedRef={nestedRef} grid={grid} density={density} />}
  </main>
}

function LabeledBlock({ label, height, color }: { label: string; height: number; color: string }) {
  return <div style={{ minHeight: height, padding: 24, border: `3px solid ${color}`, background: `${color}22`, fontSize: 18, fontWeight: 700 }}>{label}</div>
}

function DocumentScenario({ precedingHeight, grid, density }: { precedingHeight: number; grid: PlaygroundGrid; density: RowDensity }) {
  return <section style={{ margin: 16 }}><LabeledBlock label="Before table: document content" height={precedingHeight} color="#8b5cf6" /><h1 style={{ margin: "24px 0 12px" }}>Document-owned virtual table</h1><GridTable grid={grid} density={density} rawRows /><LabeledBlock label="After table: document continuation" height={280} color="#10b981" /></section>
}

function AncestorScenario({ precedingHeight, nestedRef, grid, density }: { precedingHeight: number; nestedRef: RefObject<HTMLDivElement | null>; grid: PlaygroundGrid; density: RowDensity }) {
  return <section style={{ margin: 16, minHeight: 0, flex: "1 1 auto", display: "flex", flexDirection: "column" }}><h1 style={{ flex: "0 0 auto" }}>Nested overflow owner</h1><div ref={nestedRef} data-testid="playground-ancestor-owner" style={{ minHeight: 0, flex: "1 1 auto", overflowY: "auto", border: "5px solid #f97316", borderRadius: 10, background: "#fff" }}><LabeledBlock label="Before table: nested owner content" height={precedingHeight} color="#8b5cf6" /><h2 style={{ margin: 24 }}>Ancestor-owned virtual table</h2><GridTable grid={grid} density={density} rawRows /><LabeledBlock label="After table: nested owner continuation" height={280} color="#10b981" /></div></section>
}

createRoot(document.getElementById("root")!).render(<App />)
