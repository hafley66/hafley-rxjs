import mermaid from "mermaid";
import { mermaidTheme } from "./0_diagramTheme.js";

let nextDiagramId = 0;

export async function renderMermaidSvg(code: string, dark: boolean): Promise<string> {
  const id = `instant-mermaid-${nextDiagramId++}`;
  mermaid.initialize({
    startOnLoad: false,
    ...mermaidTheme(dark),
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Arial, sans-serif",
    // Top-level htmlLabels is the only switch mermaid 11 honours; flowchart.htmlLabels
    // alone still emits foreignObject, which WebKit rasterises once and cannot resharpen.
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    securityLevel: "strict",
    suppressErrorRendering: true,
    maxEdges: 2_000,
  });
  const { svg } = await mermaid.render(id, code);
  return svg;
}
