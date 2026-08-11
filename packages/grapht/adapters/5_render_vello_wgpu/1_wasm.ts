export type VelloBrowserRenderer = {
  load_fixture_json(fixtureJson: string): void
  set_camera_pan(dx: number, dy: number): void
  set_camera_wheel_zoom(deltaY: number, anchorX: number, anchorY: number): void
  set_style(nodeCount: number, color: number): void
  update_positions(nodeCount: number, dx: number, dy: number): void
  resize(width: number, height: number): void
  render_frame(): number
  node_count(): number
  edge_count(): number
  dispose(): void
}

export type VelloWasmModule = {
  default(input?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module): Promise<void>
  VelloBrowserRenderer: { create(canvas: HTMLCanvasElement, width: number, height: number): Promise<VelloBrowserRenderer> }
}
