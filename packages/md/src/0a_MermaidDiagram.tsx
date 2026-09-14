import { useEffect, useState, type KeyboardEvent } from "react";
import { DiagramLightbox, diagramSvgMarkup } from "./0_DiagramLightbox.js";
import { renderMermaidSvg } from "./0a_mermaid.js";
import { getMdviewHost } from "./ports.js";

export function MermaidDiagram({ code, dark }: { code: string; dark: boolean }) {
  const host = getMdviewHost();
  host.useRenderProbe("MermaidDiagram", undefined, { dark, sourceBytes: code.length });
  host.useLifecycleProbe("MermaidDiagram");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let disposed = false;
    void renderMermaidSvg(code, dark)
      .then((rendered) => {
        host.recordOperation("mdview.renderMermaid", { dark, sourceBytes: code.length, svgBytes: rendered.length });
        if (!disposed) {
          setError("");
          setSvg(rendered);
        }
      })
      .catch((reason: unknown) => {
        if (!disposed) {
          setSvg("");
          setError(reason instanceof Error ? reason.message : "Failed to render Mermaid diagram");
        }
      });
    return () => {
      disposed = true;
    };
  }, [code, dark]);

  if (error) return <pre className="mdview-mermaid-error">{error}</pre>;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="mdview-mermaid"
        data-diagram-theme={dark ? "dark" : "light"}
        title="Open diagram"
        onClick={() => setOpen(true)}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        dangerouslySetInnerHTML={{ __html: diagramSvgMarkup(svg) }}
      />
      {open && <DiagramLightbox svg={svg} label="Mermaid diagram" language="mermaid" dark={dark} onClose={() => setOpen(false)} />}
    </>
  );
}
