// A mounted diagram answers "which bytes did this element come from". The index
// is built with the frame and keyed by the mounting host, so a pointer target
// inside the SVG resolves through the decorated binding ids the adapter wrote.
import type { SourceSpan } from "@hafley66/grapht-model";
import type { SequenceSourceIndex } from "./0b_sequenceFrame.js";

const indexes = new WeakMap<Element, SequenceSourceIndex>();

export function recordSequenceSource(host: Element, index: SequenceSourceIndex): void {
  indexes.set(host, index);
}

export function releaseSequenceSource(host: Element): void {
  indexes.delete(host);
}

export function sequenceSourceIndex(host: Element): SequenceSourceIndex | undefined {
  return indexes.get(host);
}

/** The span a rendered element came from, or undefined for an unbound diagram. */
export function sourceSpanOfElement(element: Element): SourceSpan | undefined {
  const host = element.closest("[data-grapht-host]");
  if (!host) return undefined;
  const index = indexes.get(host);
  if (!index) return undefined;
  // The pointer target is often a descendant of the bound primitive (a tspan in
  // a message label), so walk outward until a decorated binding id matches.
  for (let cursor: Element | null = element; cursor && host.contains(cursor); cursor = cursor.parentElement) {
    const graphId = cursor.id ? index.graphIdByElementId[cursor.id] : undefined;
    if (graphId) return index.spanByGraphId[graphId];
  }
  return undefined;
}
