import { type AnySpec, useDrawIn, type ValuesOf } from "@hafley66/report-shell"
import type { CSSProperties, ReactNode } from "react"
import { useRef } from "react"
import { type Algo, type AlgoOut, algoCtx } from "../kit/2_algo.js"
import { Section } from "./2_Section.js"

const f = (n: number) => Math.round(n * 100) / 100

// z lands on data-z and --z; the depth rule in app.css reads it
export function AlgoSvg({ out, size }: { out: AlgoOut; size: number }): ReactNode {
  return (
    <svg
      className="kit-draw"
      viewBox={`${f(-size / 2)} ${f(-size / 2)} ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={out.caption}
    >
      <title>{out.caption}</title>
      {out.paths.map((p, i) => (
        <path
          // biome-ignore lint/suspicious/noArrayIndexKey: paths are positional, the whole set is rebuilt together
          key={i}
          d={p.d}
          pathLength={1}
          className={p.cls}
          data-z={p.z === undefined ? undefined : f(p.z)}
          style={p.z === undefined ? undefined : ({ "--z": f(p.z) } as CSSProperties)}
        />
      ))}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: generator-built textPath markup, no user input */}
      {out.raw?.length ? <g dangerouslySetInnerHTML={{ __html: out.raw.join("") }} /> : null}
    </svg>
  )
}

export function AlgoCells<P extends object>({
  algo,
  sizes,
  params,
}: {
  algo: Algo<P>
  sizes: readonly number[]
  params: P
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null)
  const outs = sizes.map(size => algo.run(params, algoCtx(params, size)))
  useDrawIn(ref, [algo.name, JSON.stringify(params), sizes.join()])
  return (
    <div ref={ref} className="row flex flex-wrap items-end gap-5">
      {outs.map((out, i) => (
        <div key={sizes[i]} className="cell grid justify-items-center gap-1 text-[10px] text-muted">
          <AlgoSvg out={out} size={sizes[i]} />
          <span>{`${sizes[i]} · ${out.caption}${out.lod.length ? ` · ${out.lod.join(" ")}` : ""}`}</span>
        </div>
      ))}
    </div>
  )
}

export function AlgoSection<P extends object>({
  page,
  algo,
  sizes,
  title = algo.name,
  slice = false,
}: {
  page: string
  algo: Algo<P>
  sizes: readonly number[]
  title?: string
  slice?: boolean
}): ReactNode {
  return (
    <Section
      page={page}
      slice={slice}
      def={{
        id: algo.name,
        title,
        spec: algo.spec as unknown as AnySpec,
        presets: algo.presets as never,
      }}
    >
      {(v: ValuesOf<AnySpec>) => <AlgoCells algo={algo} sizes={sizes} params={v as unknown as P} />}
    </Section>
  )
}
