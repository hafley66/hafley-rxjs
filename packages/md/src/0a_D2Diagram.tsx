import { useEffect, useState, type KeyboardEvent } from "react";
import { DiagramLightbox, diagramSvgMarkup } from "./0_DiagramLightbox.js";
import { renderD2 } from "./d2.js";
import { getMdviewHost } from "./ports.js";
import { CAT_DIAGRAM, LOG, mdNow } from "./0_log.js";

export function D2Diagram({ code, dark }: { code: string; dark: boolean }) {
  const host = getMdviewHost();
  host.useRenderProbe("D2Diagram", undefined, { dark, sourceBytes: code.length });
  host.useLifecycleProbe("D2Diagram");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let disposed = false;
    const started = mdNow();
    void renderD2(code, dark)
      .then((rendered) => {
        if (LOG.on) LOG.emit(CAT_DIAGRAM, "d2 {durationMs}ms", { kind: "d2", durationMs: Math.round(mdNow() - started), sourceBytes: code.length, svgBytes: rendered.length });
        host.recordOperation("mdview.renderD2", { dark, sourceBytes: code.length, svgBytes: rendered.length, elapsedMs: Math.round(mdNow() - started) });
        if (!disposed) {
          setError("");
          setSvg(rendered);
        }
      })
      .catch((reason: unknown) => {
        if (!disposed) {
          setSvg("");
          setError(reason instanceof Error ? reason.message : "Failed to render d2 diagram");
        }
      });
    return () => {
      disposed = true;
    };
  }, [code, dark]);

  if (error) return <pre className="mdview-d2-error">{error}</pre>;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="mdview-d2"
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
      {open && <DiagramLightbox svg={svg} label="d2 diagram" language="d2" dark={dark} onClose={() => setOpen(false)} />}
    </>
  );
}
