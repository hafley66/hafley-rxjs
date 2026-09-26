import { useEffect, useRef, useState } from "react";
import { graphRenderReceipt } from "@hafley66/grapht/browser";
import { createCytoscapeGraphFrameResource } from "@hafley66/grapht-render-cytoscape";
import { DiagramLightbox } from "./0_DiagramLightbox.js";
import { renderMermaidSvg } from "./0a_mermaid.js";
import type { FenceOrigin } from "./0b_fenceOrigin.js";
import type { DiagramLanguage } from "./0b_isSequenceSource.js";
import { sequenceFrameWithSource } from "./0b_sequenceFrame.js";
import { recordSequenceSource, releaseSequenceSource } from "./0b_sequenceSource.js";
import { renderD2 } from "./d2.js";
import { optionalMdviewHost } from "./ports.js";

const FALLBACK_VIEWPORT = { width: 800, height: 420 };

export function SequenceDiagram({
  code,
  language,
  dark,
  sourceStart,
}: {
  code: string;
  language: DiagramLanguage;
  dark: boolean;
  /** Where the fence body starts in the file, when the caller knows it. */
  sourceStart?: FenceOrigin;
}) {
  const host = optionalMdviewHost();
  host?.useRenderProbe("SequenceDiagram", language, { dark, sourceBytes: code.length });
  host?.useLifecycleProbe("SequenceDiagram");
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const originStart = sourceStart?.start;
  const originLine = sourceStart?.lineStart;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let resource: ReturnType<typeof createCytoscapeGraphFrameResource> | undefined;
    const rendering = language === "mermaid" ? renderMermaidSvg(code, dark) : renderD2(code, dark);
    void rendering
      .then((rendered) => {
        if (disposed) return;
        const origin = originStart !== undefined && originLine !== undefined
          ? { start: originStart, lineStart: originLine }
          : undefined;
        const { frame, source } = sequenceFrameWithSource(mount.ownerDocument, language, code, rendered, {
          width: mount.clientWidth || FALLBACK_VIEWPORT.width,
          height: mount.clientHeight || FALLBACK_VIEWPORT.height,
        }, origin);
        if (source) recordSequenceSource(mount, source);
        resource = createCytoscapeGraphFrameResource(mount, undefined, { ribbon: true });
        resource.applyTheme(dark ? "dark" : "light");
        resource.render(frame, graphRenderReceipt(new Set(), frame));
        // One item is the sealed root alone: the language adapter recovered no bindings.
        mount.dataset.graphtItems = String(Object.keys(frame.graph).length);
        // The file offset this fence body starts at, so a page can name its bytes
        // without reaching into the frame.
        if (origin) mount.dataset.graphtSource = String(origin.start);
        host?.recordOperation("mdview.renderSequence", {
          language,
          dark,
          sourceBytes: code.length,
          svgBytes: rendered.length,
          boundIds: Object.keys(frame.graph).length,
          sourceStart: originStart ?? -1,
        });
        setError("");
        setSvg(rendered);
      })
      .catch((reason: unknown) => {
        if (disposed) return;
        setSvg("");
        setError(reason instanceof Error ? reason.message : `Failed to render ${language} sequence diagram`);
      });
    return () => {
      disposed = true;
      releaseSequenceSource(mount);
      resource?.unsubscribe();
    };
  }, [code, dark, language, originStart, originLine]);

  if (error) return <pre className="mdview-sequence-error">{error}</pre>;

  return (
    <>
      <div className="mdview-sequence" data-diagram-theme={dark ? "dark" : "light"} data-diagram-language={language}>
        <div ref={mountRef} className="mdview-sequence-graph" data-grapht-host={language} />
        <button type="button" className="mdview-sequence-open" title="Open diagram" disabled={svg === ""} onClick={() => setOpen(true)}>
          ⤢
        </button>
      </div>
      {open && (
        <DiagramLightbox
          svg={svg}
          label={`${language} sequence diagram`}
          language={language}
          dark={dark}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
