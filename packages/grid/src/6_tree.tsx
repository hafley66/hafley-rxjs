import { useState } from "react"
import type { RowData } from "@tanstack/react-table"
import { useGrid } from "./3_react"
import type { Grid } from "./1_types"

const FONT = `-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

const EXT_COLOR: Record<string, string> = {
  ts: "#3178c6", tsx: "#3178c6", js: "#e8b400", jsx: "#e8b400",
  json: "#a3a323", md: "#6b7280", css: "#663399", html: "#e34c26",
  png: "#c026d3", jpg: "#c026d3", svg: "#f59e0b",
}

const extOf = (name: string) => {
  const i = name.lastIndexOf(".")
  return i > 0 ? name.slice(i + 1).toLowerCase() : ""
}

type TreeLike = { name: string; kind?: string }

const Folder = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill={open ? "#3b82f6" : "#93b4f5"} d="M3 6.5 A1.5 1.5 0 0 1 4.5 5 H9 l2 2 h8.5 A1.5 1.5 0 0 1 21 8.5 V18 A1.5 1.5 0 0 1 19.5 19.5 H4.5 A1.5 1.5 0 0 1 3 18 Z" />
  </svg>
)

const FileIcon = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill={color} fillOpacity=".15" d="M6 3.5 A1.5 1.5 0 0 1 7.5 2 H14 L20 8 V20.5 A1.5 1.5 0 0 1 18.5 22 H7.5 A1.5 1.5 0 0 1 6 20.5 Z" />
    <path fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" d="M6 3.5 A1.5 1.5 0 0 1 7.5 2 H14 L20 8 V20.5 A1.5 1.5 0 0 1 18.5 22 H7.5 A1.5 1.5 0 0 1 6 20.5 Z M14 2 V6.5 A1.5 1.5 0 0 0 15.5 8 H20" />
  </svg>
)

// Generic node icon for anything that is neither folder nor file (e.g. an AST block).
const NodeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <circle cx="6" cy="12" r="2.4" fill="#9ca3af" />
    <path fill="none" stroke="#d1d5db" strokeWidth="1.4" d="M9 12 H20" />
  </svg>
)

const iconFor = (node: TreeLike, open: boolean) => {
  if (node.kind === "folder") return <Folder open={open} />
  if (node.kind === "file" || node.kind === undefined) {
    return <FileIcon color={EXT_COLOR[extOf(node.name)] ?? "#9ca3af"} />
  }
  return <NodeIcon />
}

// Any row with getSubRows children is a container; an open container gains a
// trailing "/", so a file expanding into its own AST reads as a folder too.
export function GridTree<TData extends RowData & TreeLike>({
  grid,
  indentUnit = 14,
  rowHeight = 24,
  label,
  width = 360,
}: {
  grid: Grid<TData>
  indentUnit?: number
  rowHeight?: number
  label?: string
  width?: number
}) {
  const table = useGrid(grid)
  const rows = table.getRowModel().rows
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div
      data-testid="grid-tree"
      style={{
        width,
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 18px 36px -18px rgba(16,24,40,.18)",
        fontFamily: FONT,
        lineHeight: 1,
        color: "#1f2937",
        overflow: "hidden",
      }}
    >
      <style>{`.gt-row:hover{background:rgba(59,130,246,.09)}.gt-row.sel{background:rgba(59,130,246,.16)}`}</style>
      {label ? (
        <div style={{
          padding: "8px 12px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "#6b7280",
          borderBottom: "1px solid #f3f4f6",
        }}>{label}</div>
      ) : null}
      <div style={{ maxHeight: 560, overflowY: "auto", padding: "4px 0" }}>
        {rows.map((row) => {
          const node = row.original as TreeLike
          const depth = row.depth
          const canExpand = row.getCanExpand()
          const open = row.getIsExpanded()
          const text = open ? `${node.name}/` : node.name
          return (
            <div
              key={row.id}
              className={`gt-row${selected === row.id ? " sel" : ""}`}
              onClick={() => setSelected(row.id)}
              style={{
                position: "relative",
                height: rowHeight,
                display: "flex",
                alignItems: "center",
                paddingLeft: 8 + depth * indentUnit,
                cursor: "default",
              }}
            >
              {Array.from({ length: depth }, (_, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    left: 8 + i * indentUnit + indentUnit / 2,
                    top: 0,
                    bottom: 0,
                    borderLeft: "1px solid rgba(0,0,0,.08)",
                  }}
                />
              ))}
              <span style={{ width: 18, flex: "0 0 18px", display: "inline-flex", justifyContent: "center", color: "#9ca3af" }}>
                {canExpand ? (
                  <button
                    data-testid={`toggle-${row.id}`}
                    onClick={row.getToggleExpandedHandler()}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                      display: "inline-flex",
                      transform: open ? "rotate(90deg)" : "none",
                      transition: "transform 100ms ease",
                    }}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8"><path d="M2 1 L6 4 L2 7 Z" fill="currentColor" /></svg>
                  </button>
                ) : null}
              </span>
              <span style={{ width: 20, flex: "0 0 20px", display: "inline-flex", alignItems: "center" }}>
                {iconFor(node, open)}
              </span>
              <span style={{
                fontSize: 13,
                whiteSpace: "nowrap",
                fontWeight: node.kind === "folder" ? 600 : 400,
                color: "#1f2937",
              }}>{text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
