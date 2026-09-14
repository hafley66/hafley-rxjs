import { svgFrame, type GraphFrame } from "@hafley66/grapht/browser";
import {
  decorateSvg,
  documentFingerprint,
  sequenceDocumentToGraph,
  type Graph,
  type NativeRenderReceipt,
  type NativeSvgElement,
  type SvgBindingReceipt,
} from "@hafley66/grapht-model";
import { bindMermaidSvg, identifyMermaidOccurrences, parseMermaidSequence } from "@hafley66/mmd/browser";
import { bindD2Svg, identifyD2Occurrences, parseD2Sequence } from "@hafley66/d2/browser";
import type { DiagramLanguage } from "./0b_isSequenceSource.js";

const TEXT_TAGS = new Set(["desc", "text", "title", "tspan"]);
export const SEQUENCE_ROOT_ID = "sequence";

function svgElements(root: Element): NativeSvgElement[] {
  return [root, ...root.querySelectorAll("*")].map((element) => {
    const path: number[] = [];
    let cursor: Element = element;
    while (cursor !== root) {
      const parent = cursor.parentElement;
      if (!parent) throw new Error("SVG element detached during the receipt walk");
      path.unshift([...parent.children].indexOf(cursor));
      cursor = parent;
    }
    const attributes = Object.fromEntries(
      [...element.attributes]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((attribute) => [attribute.name, attribute.value]),
    );
    const text = TEXT_TAGS.has(element.tagName.toLowerCase())
      ? [...element.childNodes]
          .filter((node) => node.nodeType === 3)
          .map((node) => node.textContent)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
    return {
      path,
      tag: element.tagName.toLowerCase(),
      ...(element.id ? { id: element.id } : {}),
      classes: [...element.classList].sort(),
      ...(text ? { text } : {}),
      attributes,
    };
  });
}

/** Rebuild the adapter receipt in the browser: the packaged adapters produce it through
 * playwright, which cannot run in a renderer process. */
export function sequenceRenderReceipt(language: DiagramLanguage, code: string, svg: string): NativeRenderReceipt {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = parsed.documentElement;
  if (parsed.querySelector("parsererror") || root.localName !== "svg") {
    throw new Error("sequence renderer produced no SVG root");
  }
  return {
    language,
    rendererPackage: language === "mermaid" ? "mermaid" : "@terrastruct/d2",
    rendererVersion: "browser",
    sourceHash: documentFingerprint(code),
    svgHash: documentFingerprint(svg),
    options: {},
    svg,
    elements: svgElements(root),
  };
}

function boundFrame(
  document: Document,
  language: DiagramLanguage,
  code: string,
  svg: string,
  viewport: { width: number; height: number },
): GraphFrame {
  const receipt = sequenceRenderReceipt(language, code, svg);
  const occurrences = language === "mermaid"
    ? identifyMermaidOccurrences(parseMermaidSequence(code))
    : identifyD2Occurrences(parseD2Sequence(code));
  const bindings: SvgBindingReceipt = language === "mermaid"
    ? bindMermaidSvg(parseMermaidSequence(code), occurrences, receipt)
    : bindD2Svg(parseD2Sequence(code), occurrences, receipt);
  if (bindings.bindings.length === 0) throw new Error("sequence source bound no SVG elements");
  const graph: Graph = sequenceDocumentToGraph(occurrences);
  return svgFrame(document, {
    svg: decorateSvg(receipt, bindings),
    locator: `${language}:sequence`,
    rootId: SEQUENCE_ROOT_ID,
    viewport,
    graph,
    bindings: bindings.bindings.map((binding) => ({
      elementId: binding.elementId,
      graphId: binding.occurrenceId,
      role: binding.role,
      ordinal: binding.ordinal,
    })),
  });
}

/** Native bindings come from the language adapter; an unbindable diagram still ingests as a
 * source-preserving sealed frame, which is the plain-SVG behaviour the fence had before. */
export function sequenceFrame(
  document: Document,
  language: DiagramLanguage,
  code: string,
  svg: string,
  viewport: { width: number; height: number },
): GraphFrame {
  try {
    return boundFrame(document, language, code, svg, viewport);
  } catch {
    return svgFrame(document, { svg, locator: `${language}:sequence`, rootId: SEQUENCE_ROOT_ID, viewport });
  }
}
