/// <reference types="vite/client" />
import { Observable, defer, finalize, from, map, of, shareReplay, switchMap } from "rxjs";
import { renderD2 } from "../d2.js";

export type DiagramPalette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceMuted: string;
  text: string;
  border: string;
  line: string;
};
export type RenderableDiagram = {
  language: "mermaid" | "d2";
  code: string;
  inferred: boolean;
  stripped?: boolean;
};
export type RenderedDiagram = { svg: string; code: string; lineCount: number };
type MermaidApi = typeof import("mermaid").default;
let nextMermaidId = 0;
let pendingMermaid$: Observable<MermaidApi> | null = null;
const MAX_TAIL_RECOVERY_ATTEMPTS = 16;

function mermaidGlobal(): MermaidApi | undefined {
  return (window as Window & { mermaid?: MermaidApi }).mermaid;
}
function failureText(reason: unknown): string {
  return reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
}
async function bundleFailureReason(url: string): Promise<string> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return response.ok ? `served HTTP ${response.status}, so the bundle itself did not execute`
      : `HTTP ${response.status} ${response.statusText}`.trim();
  } catch (reason) {
    return failureText(reason);
  }
}

/** A lazy, cancellable load. With a `url`, a script lease for a UMD bundle; without one, the module import.
 * A failed attempt leaves no cached failure. */
export function loadMermaid$(url?: string): Observable<MermaidApi> {
  return defer(() => {
    const loaded = mermaidGlobal();
    if (loaded) return of(loaded);
    if (pendingMermaid$) return pendingMermaid$;
    const script$ = url === undefined ? from(import("mermaid")).pipe(map((module) => module.default)) : new Observable<MermaidApi>((observer) => {
      const script = document.createElement("script");
      script.src = url;
      const onLoad = () => {
        const api = mermaidGlobal();
        if (api) { observer.next(api); observer.complete(); }
        else observer.error(new Error(`Mermaid bundle ${script.src} ran without defining globalThis.mermaid`));
      };
      const onError = () => {
        void bundleFailureReason(script.src).then((reason) => {
          observer.error(new Error(`Mermaid bundle ${script.src} did not load: ${reason}`));
        });
      };
      script.addEventListener("load", onLoad);
      script.addEventListener("error", onError);
      document.head.appendChild(script);
      return function unsubscribe() {
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
        script.remove();
      };
    });
    const shared$ = script$.pipe(
      finalize(() => { if (pendingMermaid$ === shared$) pendingMermaid$ = null; }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    pendingMermaid$ = shared$;
    return shared$;
  });
}

function mermaidTheme(palette: DiagramPalette) {
  return {
    theme: "base" as const,
    themeVariables: {
      background: palette.background,
      primaryColor: palette.surface,
      primaryTextColor: palette.text,
      primaryBorderColor: palette.border,
      secondaryColor: palette.surfaceAlt,
      secondaryTextColor: palette.text,
      secondaryBorderColor: palette.border,
      tertiaryColor: palette.surfaceMuted,
      tertiaryTextColor: palette.text,
      tertiaryBorderColor: palette.border,
      lineColor: palette.line,
      textColor: palette.text,
      mainBkg: palette.surface,
      nodeBorder: palette.border,
      clusterBkg: palette.background,
      clusterBorder: palette.border,
      edgeLabelBackground: palette.background,
      actorBkg: palette.surface,
      actorBorder: palette.border,
      actorTextColor: palette.text,
      actorLineColor: palette.line,
      signalColor: palette.line,
      signalTextColor: palette.text,
      labelBoxBkgColor: palette.surfaceAlt,
      labelBoxBorderColor: palette.border,
      labelTextColor: palette.text,
      loopTextColor: palette.text,
      noteBkgColor: palette.surfaceMuted,
      noteBorderColor: palette.border,
      noteTextColor: palette.text,
      activationBkgColor: palette.surfaceAlt,
      activationBorderColor: palette.border,
      sequenceNumberColor: palette.background,
      labelColor: palette.text,
      altBackground: palette.surfaceAlt,
      classText: palette.text,
      attributeBackgroundColorOdd: palette.surface,
      attributeBackgroundColorEven: palette.surfaceAlt,
    },
  };
}

const d2BuiltInColors = {
  light: {
    "#ffffff": "background", "#0a0f25": "text", "#676c7e": "border", "#9499ab": "border",
    "#cfd2dd": "surfaceMuted", "#dee1eb": "surfaceMuted", "#eef1f8": "surface",
    "#010e31": "line", "#173688": "line", "#5679d4": "line", "#84a1ec": "surfaceAlt",
    "#c8d6f9": "surfaceAlt", "#e5edff": "surface", "#048e63": "line",
    "#a6e2d0": "surfaceAlt", "#caf2e6": "surfaceAlt", "#ffda90": "surfaceMuted", "#fff0d1": "surfaceMuted",
  },
  dark: {
    "#1e1e2e": "background", "#cdd6f4": "text", "#bac2de": "text", "#a6adc8": "border",
    "#585b70": "border", "#45475a": "surfaceMuted", "#313244": "surface", "#cba6f7": "line",
    "#6c7086": "border", "#f38ba8": "surfaceMuted",
  },
} as const satisfies Record<"light" | "dark", Record<string, keyof DiagramPalette>>;

function recolorD2(svg: string, palette: DiagramPalette, dark: boolean): string {
  const builtIn: Record<string, keyof DiagramPalette> = d2BuiltInColors[dark ? "dark" : "light"];
  const replaced = svg.replace(/#[0-9a-fA-F]{6}\b/g, (color) => {
    const slot = builtIn[color.toLowerCase()];
    return slot ? palette[slot] : color;
  });
  const doc = new DOMParser().parseFromString(replaced, "image/svg+xml");
  const root = doc.documentElement;
  if (root.localName !== "svg") return replaced;
  const style = doc.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `svg { background: ${palette.background}; }`;
  root.insertBefore(style, root.firstChild);
  root.querySelectorAll("rect, ellipse, circle").forEach((element) => {
    if (element.getAttribute("fill") === "white") element.setAttribute("fill", palette.background);
    if (element.hasAttribute("stroke")) element.setAttribute("stroke", palette.border);
  });
  root.querySelectorAll("text, tspan").forEach((element) => element.setAttribute("fill", palette.text));
  root.querySelectorAll("path, line, polyline").forEach((element) => {
    if (element.hasAttribute("stroke")) element.setAttribute("stroke", palette.line);
  });
  root.querySelectorAll("polygon").forEach((element) => {
    if (element.hasAttribute("fill") && element.getAttribute("fill") !== "none") element.setAttribute("fill", palette.line);
  });
  return new XMLSerializer().serializeToString(root);
}

async function renderD2Recovered(fence: RenderableDiagram, palette: DiagramPalette, dark: boolean): Promise<RenderedDiagram> {
  const lines = fence.code.split("\n");
  const minimum = Math.max(1, lines.length - MAX_TAIL_RECOVERY_ATTEMPTS + 1);
  let lastError: unknown;
  for (let length = lines.length; length >= minimum; length--) {
    const code = lines.slice(0, length).join("\n");
    try {
      const svg = await renderD2(code, dark);
      if (typeof svg !== "string") throw new Error("D2 renderer returned no SVG markup");
      return { svg: recolorD2(svg, palette, dark), code, lineCount: length };
    } catch (reason) {
      lastError = reason;
      if (!fence.stripped) throw reason;
    }
  }
  throw lastError;
}

function renderMermaidRecovered(fence: RenderableDiagram, palette: DiagramPalette, mermaid: MermaidApi): Observable<RenderedDiagram> {
  return defer(async () => {
    mermaid.initialize({
      startOnLoad: false,
      ...mermaidTheme(palette),
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      securityLevel: "strict",
      suppressErrorRendering: true,
      maxEdges: 2_000,
    });
    const lines = fence.code.split("\n");
    const minimum = Math.max(lines.length === 1 ? 1 : 2, lines.length - MAX_TAIL_RECOVERY_ATTEMPTS + 1);
    let lastError: unknown;
    for (let length = lines.length; length >= minimum; length--) {
      const code = lines.slice(0, length).join("\n");
      try {
        const rendered = await mermaid.render(`boop-terminal-mermaid-${nextMermaidId++}`, code);
        if (typeof rendered?.svg !== "string") throw new Error("Mermaid renderer returned no SVG markup");
        return { svg: rendered.svg, code, lineCount: length };
      } catch (reason) {
        lastError = reason;
        if (!fence.inferred && !fence.stripped) throw reason;
      }
    }
    throw lastError;
  });
}

export function renderDiagram$(fence: RenderableDiagram, palette: DiagramPalette, dark: boolean): Observable<RenderedDiagram> {
  return fence.language === "d2"
    ? defer(() => from(renderD2Recovered(fence, palette, dark)))
    : loadMermaid$().pipe(switchMap((mermaid) => renderMermaidRecovered(fence, palette, mermaid)));
}
