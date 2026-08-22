import type { GeometrySnapshot, GraphLanguage, GraphTopology, LayoutInput, LayoutOutput, RenderedArtifact, RenderOptions, SvgBinding } from "./0_types.js"

export interface GraphLayoutEngine {
  readonly id: string
  layout(input: LayoutInput): Promise<LayoutOutput>
}

export interface GraphSourceAdapter<L extends GraphLanguage = GraphLanguage> {
  readonly language: L
  parse(source: string): Promise<GraphTopology>
  render(source: string, options: RenderOptions): Promise<RenderedArtifact>
}

export interface SvgMeasurer<Input = unknown> {
  measure(input: Input, artifact: RenderedArtifact): GeometrySnapshot
}

export type SvgDecorator = (svg: string, bindings: SvgBinding[]) => string
