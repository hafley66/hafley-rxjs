import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SignalReact } from "@hafley66/signals/react";
import { graphRenderReceipt } from "@hafley66/grapht/browser";
import { createCytoscapeGraphFrameResource } from "@hafley66/grapht-render-cytoscape";
import { DiagramLightbox, diagramSvgMarkup } from "./0_DiagramLightbox.js";
import { renderMermaidSvg } from "./0a_mermaid.js";
import type { FenceOrigin } from "./0b_fenceOrigin.js";
import type { DiagramLanguage } from "./0b_isSequenceSource.js";
import { sequenceFrameWithSource } from "./0b_sequenceFrame.js";
import { recordSequenceSource, releaseSequenceSource } from "./0b_sequenceSource.js";
import { renderD2 } from "./d2.js";
import { getMdviewHost } from "./ports.js";
import { chordText, matchesChord, parseChord } from "@hafley66/xdom";
import { DiagramRendererSwitch } from "./0b_DiagramRendererSwitch.js";
import { mdUi } from "./signals.js";

const FALLBACK_VIEWPORT = { width: 800, height: 420 };
// The grapht canvas takes the wheel only once armed, so the doc scrolls past it.
const ARM_CHORD = "Enter";
const RELEASE_CHORD = "Escape";
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const SequenceDiagram = SignalReact(function SequenceDiagram({
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
  const host = getMdviewHost();
  host.useRenderProbe("SequenceDiagram", language, { dark, sourceBytes: code.length });
  host.useLifecycleProbe("SequenceDiagram");
  const mountRef = useRef<HTMLDivElement | null>(null);
  const resourceRef = useRef<ReturnType<typeof createCytoscapeGraphFrameResource> | undefined>(undefined);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const originStart = sourceStart?.start;
  const originLine = sourceStart?.lineStart;
  const renderer = mdUi.$().diagramRenderer;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let resource: ReturnType<typeof createCytoscapeGraphFrameResource> | undefined;
    const rendering = language === "mermaid" ? renderMermaidSvg(code, dark) : renderD2(code, dark);
    void rendering
      .then((rendered) => {
        if (disposed) return;
        if (renderer === "svg") {
          host.recordOperation("mdview.renderSequence", { language, dark, renderer, sourceBytes: code.length, svgBytes: rendered.length });
          setError("");
          setSvg(rendered);
          return;
        }
        const origin = originStart !== undefined && originLine !== undefined
          ? { start: originStart, lineStart: originLine }
          : undefined;
        const { frame, source } = sequenceFrameWithSource(mount.ownerDocument, language, code, rendered, {
          width: mount.clientWidth || FALLBACK_VIEWPORT.width,
          height: mount.clientHeight || FALLBACK_VIEWPORT.height,
        }, origin);
        if (source) recordSequenceSource(mount, source);
        resource = createCytoscapeGraphFrameResource(mount, undefined, { ribbon: true }, { wheel: "armed" });
        resourceRef.current = resource;
        resource.applyTheme(dark ? "dark" : "light");
        resource.render(frame, graphRenderReceipt(new Set(), frame));
        // One item is the sealed root alone: the language adapter recovered no bindings.
        mount.dataset.graphtItems = String(Object.keys(frame.graph).length);
        // The file offset this fence body starts at, so a page can name its bytes
        // without reaching into the frame.
        if (origin) mount.dataset.graphtSource = String(origin.start);
        host.recordOperation("mdview.renderSequence", {
          language,
          dark,
          renderer,
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
      if (resourceRef.current === resource) resourceRef.current = undefined;
      resource?.unsubscribe();
    };
  }, [code, dark, language, originStart, originLine, renderer]);

  if (error) return <pre className="mdview-sequence-error">{error}</pre>;

  return (
    <>
      <div
        className="mdview-sequence"
        data-diagram-theme={dark ? "dark" : "light"}
        data-diagram-language={language}
        data-diagram-renderer={renderer}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (matchesChord(event.nativeEvent, parseChord(ARM_CHORD))) resourceRef.current?.setWheelArmed(true);
        }}
      >
        {renderer === "grapht"
          ? <div key="grapht" ref={mountRef} className="mdview-sequence-graph" data-grapht-host={language} />
          : <div key="svg" ref={mountRef} className="mdview-sequence-svg" dangerouslySetInnerHTML={{ __html: diagramSvgMarkup(svg) }} />}
        {renderer === "grapht" && (
          <div className="mdview-sequence-notice" aria-live="polite">
            <span data-when="passive" title={`${chordText(ARM_CHORD)} also arms a focused diagram`}>
              {capitalized(chordText("RightClick"))} for scroll zoom
            </span>
            <span data-when="armed">{chordText(RELEASE_CHORD)} to release</span>
          </div>
        )}
        <DiagramRendererSwitch className="mdview-sequence-renderer" />
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
});
