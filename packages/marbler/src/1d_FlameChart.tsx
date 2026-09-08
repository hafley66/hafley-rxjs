import { useEffect, useMemo, useRef, useState } from "react"
import { DEFAULT_PHASE_STYLES, FALLBACK_PHASE_STYLE, type PhaseStyle } from "./0_types.js"
import { flameDepth, type FlameNode } from "./1c_aggregate.js"

const STRIP_HEIGHT = 22
const BAR_HEIGHT = 20
const MIN_LABEL_WIDTH = 24
const LABEL_CHAR_WIDTH = 6.2

// A `type` with no phase entry hashes into the same palette instead of collapsing to one gray.
export function flameColor(type: string, phaseStyles: Record<string, PhaseStyle>): string {
  const exact = phaseStyles[type]
  if (exact) return exact.color
  const palette = Object.keys(phaseStyles).sort().map((kind) => phaseStyles[kind].color)
  if (palette.length === 0) return FALLBACK_PHASE_STYLE.color
  let hash = 0
  for (let index = 0; index < type.length; index++) hash = (hash * 31 + type.charCodeAt(index)) >>> 0
  return palette[hash % palette.length]
}

function ellipsize(text: string, width: number): string {
  const budget = Math.floor((width - 8) / LABEL_CHAR_WIDTH)
  if (budget <= 0) return ""
  return text.length <= budget ? text : `${text.slice(0, Math.max(1, budget - 1))}…`
}

export type FlameChartProps = {
  nodes: readonly FlameNode[]
  domain: readonly [number, number]
  phaseStyles?: Record<string, PhaseStyle>
  hoveredId?: string | null
  selectedId?: string | null
  onNodeHover?: (id: string | null) => void
  onNodeSelect?: (id: string) => void
}

export function FlameChart({
  nodes,
  domain,
  phaseStyles = DEFAULT_PHASE_STYLES,
  hoveredId = null,
  selectedId = null,
  onNodeHover,
  onNodeSelect,
}: FlameChartProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const measure = () => setWidth((prior) => (Math.abs(prior - host.clientWidth) < 0.5 ? prior : host.clientWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])
  const plotWidth = Math.max(1, width)
  const [domainStart, domainEnd] = domain
  const bars = useMemo(() => {
    const span = Math.max(1, domainEnd - domainStart)
    const x = (time: number) => Math.max(0, Math.min(plotWidth, ((time - domainStart) / span) * plotWidth))
    return nodes.map((node) => {
      const left = x(node.start)
      const visible = node.end >= domainStart && node.start <= domainEnd
      return {
        node,
        left,
        width: visible ? Math.max(1, x(node.end) - left) : 0,
        y: node.depth * STRIP_HEIGHT + 1,
        color: flameColor(node.type, phaseStyles),
      }
    })
  }, [nodes, domainStart, domainEnd, plotWidth, phaseStyles])
  const height = flameDepth(nodes) * STRIP_HEIGHT
  return <div ref={hostRef} className="flame-chart" data-testid="flame-chart" onMouseLeave={() => onNodeHover?.(null)}>
    <svg width={plotWidth} height={height} viewBox={`0 0 ${plotWidth} ${height}`} role="presentation">
      {bars.map((bar) => <g
        key={bar.node.id}
        className={`flame-node${selectedId === bar.node.id ? " selected" : ""}${hoveredId === bar.node.id ? " hovered" : ""}`}
        data-node-id={bar.node.id}
        data-depth={bar.node.depth}
        onMouseEnter={() => onNodeHover?.(bar.node.id)}
        onClick={() => onNodeSelect?.(bar.node.id)}
      >
        <rect x={bar.left} y={bar.y} width={bar.width} height={BAR_HEIGHT} rx={2} fill={bar.color} />
        {bar.width >= MIN_LABEL_WIDTH && <text x={bar.left + 4} y={bar.y + 14}>{ellipsize(bar.node.name, bar.width)}</text>}
      </g>)}
    </svg>
  </div>
}
